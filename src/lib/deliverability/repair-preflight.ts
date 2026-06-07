import {
  SES_EVENTS_MATCHING_EVENT_TYPES,
  configurationSetService,
  db,
  dedicatedIpPoolRepo,
  domains,
  getSesEventsSnsTopicArn,
} from "@opensend/core";
import { and, eq } from "drizzle-orm";

type DomainRow = typeof domains.$inferSelect;

export type CliOptions = {
  repair: boolean;
  strict: boolean;
  json: boolean;
  domain: string | null;
  limit: number;
};

export type EventDestinationState = {
  configured: boolean;
  enabled: boolean | null;
  topicArn: string | null;
  matchingEventTypes: string[];
};

export type DomainReport = {
  domainId: string;
  domainName: string;
  region: string;
  previousConfigSetName: string | null;
  resultingConfigSetName: string | null;
  dbWriteBack: boolean;
  eventDestination: EventDestinationState | null;
  mode: "preflight" | "repair";
  error: string | null;
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SNS_TOPIC_ARN_REGEX =
  /^arn:(aws|aws-us-gov|aws-cn):sns:[a-z0-9-]+:\d{12}:[A-Za-z0-9_.-]{1,256}$/;

export function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    repair: false,
    strict: false,
    json: false,
    domain: null,
    limit: 100,
  };

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === "--repair") {
      options.repair = true;
    } else if (arg === "--strict") {
      options.strict = true;
    } else if (arg === "--json") {
      options.json = true;
    } else if (arg === "--domain") {
      options.domain = argv[++index] ?? null;
    } else if (arg === "--limit") {
      const parsed = Number(argv[++index]);
      if (Number.isFinite(parsed) && parsed > 0) {
        options.limit = Math.min(Math.floor(parsed), 500);
      }
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
  }

  return options;
}

export function validateSesEventsSnsTopicArn(
  topicArn: string | null,
): string | null {
  if (!topicArn) {
    return "SES_EVENTS_SNS_TOPIC_ARN is required for --repair";
  }
  if (!SNS_TOPIC_ARN_REGEX.test(topicArn)) {
    return "SES_EVENTS_SNS_TOPIC_ARN must be an SNS topic ARN";
  }
  return null;
}

function printHelp() {
  console.log(`OpenSend deliverability preflight

Usage:
  bun run deliverability:preflight -- [--domain <id-or-name>] [--limit 100] [--json] [--strict]
  bun run deliverability:preflight -- --repair [--domain <id-or-name>] [--json] [--strict]

Default mode is read-only. --repair creates/updates SES configuration sets,
attaches the SES_EVENTS_SNS_TOPIC_ARN event destination, and writes back
domains.ses_configuration_set_name after a successful sync.`);
}

async function loadVerifiedDomains(options: CliOptions): Promise<DomainRow[]> {
  const filters = [eq(domains.status, "verified")];
  if (options.domain) {
    filters.push(
      UUID_REGEX.test(options.domain)
        ? eq(domains.id, options.domain)
        : eq(domains.name, options.domain.toLowerCase()),
    );
  }

  return await db
    .select()
    .from(domains)
    .where(and(...filters))
    .limit(options.limit);
}

async function resolveDedicatedIpPoolSesName(
  domain: DomainRow,
): Promise<string | null> {
  if (!domain.dedicatedIpPoolId) return null;
  const pool = await dedicatedIpPoolRepo.findById(domain.dedicatedIpPoolId);
  return pool?.sesPoolName ?? null;
}

async function readEventDestinationState(
  domain: DomainRow,
  configSetName: string | null,
): Promise<EventDestinationState | null> {
  if (!configSetName) return null;
  return await configurationSetService.getConfigurationSetEventDestinationState(
    {
      configurationSetName: configSetName,
      region: domain.region,
    },
  );
}

async function inspectDomain(
  domain: DomainRow,
  options: CliOptions,
): Promise<DomainReport> {
  const previousConfigSetName = domain.sesConfigurationSetName ?? null;
  const topicArn = getSesEventsSnsTopicArn();

  if (!options.repair) {
    try {
      return {
        domainId: domain.id,
        domainName: domain.name,
        region: domain.region,
        previousConfigSetName,
        resultingConfigSetName: previousConfigSetName,
        dbWriteBack: Boolean(previousConfigSetName),
        eventDestination: await readEventDestinationState(
          domain,
          previousConfigSetName,
        ),
        mode: "preflight",
        error: null,
      };
    } catch (error) {
      return toErrorReport(domain, previousConfigSetName, "preflight", error);
    }
  }

  try {
    const configSetName =
      await configurationSetService.syncDomainConfigurationSet({
        domainId: domain.id,
        tls: domain.tls,
        dedicatedIpPoolSesName: await resolveDedicatedIpPoolSesName(domain),
        existingConfigSetName: previousConfigSetName,
        eventDestinationTopicArn: topicArn,
        region: domain.region,
      });
    const [updated] = await db
      .update(domains)
      .set({ sesConfigurationSetName: configSetName })
      .where(eq(domains.id, domain.id))
      .returning({ id: domains.id });
    const dbWriteBack = Boolean(updated);

    return {
      domainId: domain.id,
      domainName: domain.name,
      region: domain.region,
      previousConfigSetName,
      resultingConfigSetName: dbWriteBack ? configSetName : null,
      dbWriteBack,
      eventDestination: dbWriteBack
        ? await readEventDestinationState(domain, configSetName)
        : null,
      mode: "repair",
      error: null,
    };
  } catch (error) {
    return toErrorReport(domain, previousConfigSetName, "repair", error);
  }
}

function toErrorReport(
  domain: DomainRow,
  previousConfigSetName: string | null,
  mode: "preflight" | "repair",
  error: unknown,
): DomainReport {
  return {
    domainId: domain.id,
    domainName: domain.name,
    region: domain.region,
    previousConfigSetName,
    resultingConfigSetName: previousConfigSetName,
    dbWriteBack: false,
    eventDestination: null,
    mode,
    error: error instanceof Error ? error.message : String(error),
  };
}

export function reportIssues(
  report: DomainReport,
  expectedTopicArn: string | null = null,
): string[] {
  const issues: string[] = [];
  if (!report.resultingConfigSetName) {
    issues.push("missing_config_set_writeback");
  }
  if (!report.eventDestination?.configured) {
    issues.push("missing_ses_event_destination");
  } else if (!report.eventDestination.enabled) {
    issues.push("disabled_ses_event_destination");
  } else {
    if (
      expectedTopicArn &&
      report.eventDestination.topicArn !== expectedTopicArn
    ) {
      issues.push("wrong_ses_event_destination_topic");
    }
    const configuredEventTypes = new Set(
      report.eventDestination.matchingEventTypes,
    );
    if (
      !SES_EVENTS_MATCHING_EVENT_TYPES.every((eventType) =>
        configuredEventTypes.has(eventType),
      )
    ) {
      issues.push("missing_ses_event_types");
    }
  }
  if (report.error) {
    issues.push("repair_or_preflight_error");
  }
  return issues;
}

function printTextReport(input: {
  topicArnConfigured: boolean;
  expectedTopicArn?: string | null;
  error?: string | null;
  reports: DomainReport[];
}) {
  console.log("OpenSend deliverability preflight");
  console.log(
    `SES_EVENTS_SNS_TOPIC_ARN: ${input.topicArnConfigured ? "configured" : "missing"}`,
  );
  if (input.error) {
    console.log(`repair_aborted=${input.error}`);
  }
  console.log(`domains scanned: ${input.reports.length}`);

  for (const report of input.reports) {
    const issues = reportIssues(report, input.expectedTopicArn ?? null);
    console.log(
      [
        `- ${report.domainName} (${report.domainId})`,
        `previous=${report.previousConfigSetName ?? "null"}`,
        `result=${report.resultingConfigSetName ?? "null"}`,
        `db_writeback=${report.dbWriteBack ? "yes" : "no"}`,
        `event_destination=${
          report.eventDestination?.configured ? "configured" : "missing"
        }`,
        issues.length > 0 ? `issues=${issues.join(",")}` : "issues=none",
      ].join(" "),
    );
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const topicArn = getSesEventsSnsTopicArn();
  const repairTopicArnError = options.repair
    ? validateSesEventsSnsTopicArn(topicArn)
    : null;

  if (repairTopicArnError) {
    const payload = {
      ok: false,
      mode: "repair",
      topicArnConfigured: Boolean(topicArn),
      scanned: 0,
      error: repairTopicArnError,
      reports: [] as DomainReport[],
    };
    if (options.json) {
      console.log(JSON.stringify(payload, null, 2));
    } else {
      printTextReport({
        topicArnConfigured: payload.topicArnConfigured,
        expectedTopicArn: topicArn,
        error: repairTopicArnError,
        reports: payload.reports,
      });
    }
    process.exit(1);
  }

  const verifiedDomains = await loadVerifiedDomains(options);
  const reports: DomainReport[] = [];

  for (const domain of verifiedDomains) {
    reports.push(await inspectDomain(domain, options));
  }

  const payload = {
    ok:
      Boolean(topicArn) &&
      reports.every((report) => reportIssues(report, topicArn).length === 0),
    mode: options.repair ? "repair" : "preflight",
    topicArnConfigured: Boolean(topicArn),
    scanned: reports.length,
    reports,
  };

  if (options.json) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    printTextReport({
      topicArnConfigured: payload.topicArnConfigured,
      expectedTopicArn: topicArn,
      reports,
    });
  }

  if (options.strict && !payload.ok) {
    process.exit(1);
  }
}

if (process.argv[1]?.endsWith("repair-preflight.ts")) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
