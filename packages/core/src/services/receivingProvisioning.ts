import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  CreateReceiptRuleCommand,
  CreateReceiptRuleSetCommand,
  DeleteReceiptRuleCommand,
  DescribeReceiptRuleCommand,
  type ReceiptRule,
  SESClient,
  SetActiveReceiptRuleSetCommand,
  UpdateReceiptRuleCommand,
} from "@aws-sdk/client-ses";

const DEFAULT_SES_REGION = "us-east-1";
export const DEFAULT_INBOUND_RULE_SET_NAME = "opensend-inbound";

const hasAwsCredentials =
  !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) ||
  !!process.env.AWS_PROFILE ||
  existsSync(join(process.env.HOME ?? "", ".aws", "credentials"));

const useDevStub = process.env.NODE_ENV === "development" && !hasAwsCredentials;

type SesReceivingClient = Pick<SESClient, "send">;

export type ReceivingProvisioningResult = {
  ruleSetName: string;
  ruleName: string;
  action: "created" | "updated" | "deleted" | "noop";
};

export type ReceivingProvisioningConfig = {
  ruleSetName: string;
  bucketName: string;
  topicArn: string;
  objectKeyPrefixForDomain: (domainName: string) => string;
};

export type ReceivingProvisioningErrorCode = "missing_config";

export class ReceivingProvisioningError extends Error {
  constructor(
    readonly code: ReceivingProvisioningErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ReceivingProvisioningError";
  }
}

function normalizeSesRegion(region: string | null | undefined): string {
  const trimmed = region?.trim();
  return trimmed || DEFAULT_SES_REGION;
}

function readConfiguredValue(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed || trimmed === "undefined" || trimmed === "null") return null;
  return trimmed;
}

export function getSesInboundSnsTopicArn(): string | null {
  return readConfiguredValue(process.env.SES_INBOUND_SNS_TOPIC_ARN);
}

export function getSesInboundBucketName(): string | null {
  return (
    readConfiguredValue(process.env.SES_INBOUND_BUCKET_NAME) ??
    readConfiguredValue(process.env.S3_BUCKET_NAME)
  );
}

export function getSesInboundRuleSetName(): string {
  return (
    readConfiguredValue(process.env.SES_INBOUND_RULE_SET_NAME) ??
    DEFAULT_INBOUND_RULE_SET_NAME
  );
}

export function buildInboundObjectPrefix(domainName: string): string {
  return `ses-inbound/${domainName.trim().toLowerCase()}/`;
}

export function buildReceivingReceiptRuleName(domainName: string): string {
  const normalized =
    domainName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, "") || "domain";
  const base = `opensend-${normalized}`;

  if (base.length <= 64) return base;

  const hash = createHash("sha256")
    .update(normalized)
    .digest("hex")
    .slice(0, 10);
  const maxPrefixLength = 64 - hash.length - 1;
  const prefix =
    base.slice(0, maxPrefixLength).replace(/[^a-z0-9]+$/g, "") ||
    "opensend-domain";
  return `${prefix}-${hash}`;
}

function readConfig(): ReceivingProvisioningConfig {
  const bucketName = getSesInboundBucketName();
  const topicArn = getSesInboundSnsTopicArn();

  if (!bucketName || !topicArn) {
    throw new ReceivingProvisioningError(
      "missing_config",
      "OpenSend receiving is not configured. Set SES_INBOUND_SNS_TOPIC_ARN and S3_BUCKET_NAME or SES_INBOUND_BUCKET_NAME before enabling receiving.",
    );
  }

  return {
    ruleSetName: getSesInboundRuleSetName(),
    bucketName,
    topicArn,
    objectKeyPrefixForDomain: buildInboundObjectPrefix,
  };
}

function buildReceiptRule(input: {
  domainName: string;
  ruleName: string;
  config: ReceivingProvisioningConfig;
}): ReceiptRule {
  const domainName = input.domainName.trim().toLowerCase();

  return {
    Name: input.ruleName,
    Enabled: true,
    Recipients: [domainName],
    ScanEnabled: true,
    Actions: [
      {
        S3Action: {
          BucketName: input.config.bucketName,
          ObjectKeyPrefix: input.config.objectKeyPrefixForDomain(domainName),
          TopicArn: input.config.topicArn,
        },
      },
    ],
  };
}

function errorName(error: unknown): string | null {
  if (typeof error !== "object" || error === null || !("name" in error)) {
    return null;
  }
  const name = (error as { name: unknown }).name;
  return typeof name === "string" ? name : null;
}

function isAlreadyExistsError(error: unknown): boolean {
  return errorName(error) === "AlreadyExistsException";
}

function isMissingRuleError(error: unknown): boolean {
  const name = errorName(error);
  return (
    name === "RuleDoesNotExistException" ||
    name === "RuleSetDoesNotExistException" ||
    name === "NotFoundException"
  );
}

export class ReceivingProvisioningService {
  private readonly clients = new Map<string, SESClient>();

  constructor(private readonly configReader = readConfig) {}

  private getClient(region?: string | null): SesReceivingClient {
    const resolved = normalizeSesRegion(region);
    const cached = this.clients.get(resolved);
    if (cached) return cached;
    const client = new SESClient({ region: resolved });
    this.clients.set(resolved, client);
    return client;
  }

  private readRuleSetNameForDelete(): string {
    try {
      return this.configReader().ruleSetName;
    } catch (error) {
      if (error instanceof ReceivingProvisioningError) {
        return getSesInboundRuleSetName();
      }
      throw error;
    }
  }

  private async ensureRuleSet(input: {
    client: SesReceivingClient;
    ruleSetName: string;
  }): Promise<void> {
    try {
      await input.client.send(
        new CreateReceiptRuleSetCommand({
          RuleSetName: input.ruleSetName,
        }),
      );
    } catch (error) {
      if (!isAlreadyExistsError(error)) throw error;
    }

    await input.client.send(
      new SetActiveReceiptRuleSetCommand({
        RuleSetName: input.ruleSetName,
      }),
    );
  }

  async provisionDomain(input: {
    domainName: string;
    region?: string | null;
  }): Promise<ReceivingProvisioningResult> {
    const ruleName = buildReceivingReceiptRuleName(input.domainName);

    if (useDevStub) {
      console.log(
        `[DEV] Would provision SES receiving rule ${ruleName} for ${input.domainName}`,
      );
      return {
        ruleSetName: getSesInboundRuleSetName(),
        ruleName,
        action: "noop",
      };
    }

    const config = this.configReader();
    const client = this.getClient(input.region);
    await this.ensureRuleSet({ client, ruleSetName: config.ruleSetName });

    const rule = buildReceiptRule({
      domainName: input.domainName,
      ruleName,
      config,
    });

    try {
      await client.send(
        new DescribeReceiptRuleCommand({
          RuleSetName: config.ruleSetName,
          RuleName: ruleName,
        }),
      );
      await client.send(
        new UpdateReceiptRuleCommand({
          RuleSetName: config.ruleSetName,
          Rule: rule,
        }),
      );
      return { ruleSetName: config.ruleSetName, ruleName, action: "updated" };
    } catch (error) {
      if (!isMissingRuleError(error)) throw error;
    }

    try {
      await client.send(
        new CreateReceiptRuleCommand({
          RuleSetName: config.ruleSetName,
          Rule: rule,
        }),
      );
      return { ruleSetName: config.ruleSetName, ruleName, action: "created" };
    } catch (error) {
      if (!isAlreadyExistsError(error)) throw error;
      await client.send(
        new UpdateReceiptRuleCommand({
          RuleSetName: config.ruleSetName,
          Rule: rule,
        }),
      );
      return { ruleSetName: config.ruleSetName, ruleName, action: "updated" };
    }
  }

  async deprovisionDomain(input: {
    domainName: string;
    region?: string | null;
  }): Promise<ReceivingProvisioningResult> {
    const ruleName = buildReceivingReceiptRuleName(input.domainName);

    if (useDevStub) {
      console.log(
        `[DEV] Would delete SES receiving rule ${ruleName} for ${input.domainName}`,
      );
      return {
        ruleSetName: getSesInboundRuleSetName(),
        ruleName,
        action: "noop",
      };
    }

    const ruleSetName = this.readRuleSetNameForDelete();
    const client = this.getClient(input.region);

    try {
      await client.send(
        new DeleteReceiptRuleCommand({
          RuleSetName: ruleSetName,
          RuleName: ruleName,
        }),
      );
      return { ruleSetName, ruleName, action: "deleted" };
    } catch (error) {
      if (!isMissingRuleError(error)) throw error;
      return { ruleSetName, ruleName, action: "noop" };
    }
  }
}

export const receivingProvisioningService = new ReceivingProvisioningService();
