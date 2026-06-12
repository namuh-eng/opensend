import { dedicatedIpPoolRepo } from "../db/repositories/dedicatedIpPoolRepo";
import { domainRepo } from "../db/repositories/domainRepo";
import type { domains } from "../db/schema";
import { configurationSetService } from "./configurationSet";
import { domainIdentityProvider } from "./domain-providers";

type DomainRow = typeof domains.$inferSelect;
type DomainInsert = typeof domains.$inferInsert;

type DomainRecord = NonNullable<DomainRow["records"]>[number];
type DomainCapability = NonNullable<DomainRow["capabilities"]>[number];

export const DEFAULT_RETURN_PATH = "send";
export const DMARC_RECORD_VALUE = "v=DMARC1; p=none;";
export const DEFAULT_TRACKING_CNAME_TARGET = "localhost";

export function buildDmarcRecordName(domainName: string): string {
  return `_dmarc.${domainName}`;
}

export function getEffectiveReturnPathLabel(
  customReturnPath: string | null | undefined,
): string {
  return customReturnPath?.trim() || DEFAULT_RETURN_PATH;
}

export function buildReturnPathRecordName(
  domainName: string,
  customReturnPath: string | null | undefined,
): string {
  return `${getEffectiveReturnPathLabel(customReturnPath)}.${domainName}`;
}

function normalizeHostnameFromUrlish(value: string | null | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) return "";

  try {
    return new URL(trimmed).hostname;
  } catch {
    try {
      return new URL(`https://${trimmed}`).hostname;
    } catch {
      return "";
    }
  }
}

export function getTrackingCnameTarget(): string {
  return (
    normalizeHostnameFromUrlish(process.env.TRACKING_CNAME_TARGET) ||
    normalizeHostnameFromUrlish(process.env.TRACKING_BASE_URL) ||
    normalizeHostnameFromUrlish(process.env.NEXT_PUBLIC_APP_URL) ||
    normalizeHostnameFromUrlish(process.env.APP_URL) ||
    normalizeHostnameFromUrlish(
      process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
    ) ||
    DEFAULT_TRACKING_CNAME_TARGET
  );
}

export function getSesEventsSnsTopicArn(): string | null {
  const topicArn = process.env.SES_EVENTS_SNS_TOPIC_ARN?.trim();
  if (!topicArn || topicArn === "undefined" || topicArn === "null") {
    return null;
  }
  return topicArn;
}

export function buildTrackingSubdomainRecordName(
  domainName: string,
  trackingSubdomain: string | null | undefined,
): string | null {
  const label = trackingSubdomain?.trim().toLowerCase();
  if (!label) return null;

  // Historical rows may contain the full host. New Resend-compatible writes are
  // validated as a single DNS label, but preserving full-host reads avoids
  // breaking already-configured tracking links.
  if (label.includes(".")) return label;

  return `${label}.${domainName}`;
}

export function buildTrackingCnameRecord(
  domainName: string,
  trackingSubdomain: string | null | undefined,
  target = getTrackingCnameTarget(),
): DomainRecord | null {
  const name = buildTrackingSubdomainRecordName(domainName, trackingSubdomain);
  if (!name) return null;

  return {
    type: "CNAME",
    name,
    value: target,
    status: "pending",
    ttl: "Auto",
  };
}

export function syncTrackingCnameRecord(input: {
  records: DomainRecord[];
  domainName: string;
  previousTrackingSubdomain: string | null | undefined;
  nextTrackingSubdomain: string | null | undefined;
}): DomainRecord[] {
  const previousName = buildTrackingSubdomainRecordName(
    input.domainName,
    input.previousTrackingSubdomain,
  );
  const nextRecord = buildTrackingCnameRecord(
    input.domainName,
    input.nextTrackingSubdomain,
  );
  const nextName = nextRecord?.name ?? null;

  const retainedRecords = input.records.filter((record) => {
    if (record.type !== "CNAME") return true;
    return record.name !== previousName && record.name !== nextName;
  });

  return nextRecord ? [...retainedRecords, nextRecord] : retainedRecords;
}

export type CreateDomainIdentityResult = {
  dkimOrigin?: "AWS_SES" | "EXTERNAL";
  status?: string;
  // AWS_SES path
  dkimTokens?: string[];
  // EXTERNAL (BYO-DKIM) path — opensend owns the keypair, SES signs with it.
  dkimSelector?: string;
  dkimPublicKey?: string;
  dkimPrivateKeyEnc?: { ct: string; iv: string };
};

export type CreateDomainInput = {
  name: string;
  region?: string;
  customReturnPath?: string;
  openTracking?: boolean;
  clickTracking?: boolean;
  trackingSubdomain?: string;
  tls?: string;
  capabilities?: DomainCapability[];
  userId?: string | null;
};

export type DomainDetail = Pick<
  DomainRow,
  | "id"
  | "name"
  | "status"
  | "region"
  | "records"
  | "trackOpens"
  | "trackClicks"
  | "trackingSubdomain"
  | "tls"
  | "capabilities"
  | "createdAt"
  | "customReturnPath"
>;

export type DomainServiceListItem = Pick<
  DomainRow,
  "id" | "name" | "status" | "region" | "capabilities" | "createdAt"
>;

export type DomainListResult = {
  data: DomainServiceListItem[];
  hasMore: boolean;
};

export type DomainRepository = {
  list(options: {
    limit?: number;
    after?: string;
    userId?: string | null;
  }): Promise<{
    data: DomainRow[];
    hasMore: boolean;
  }>;
  listPendingVerification(options?: { limit?: number }): Promise<DomainRow[]>;
  create(data: DomainInsert): Promise<DomainRow[]>;
  findById(id: string): Promise<DomainRow | undefined>;
  update(id: string, data: Partial<DomainInsert>): Promise<DomainRow[]>;
  delete(id: string): Promise<Array<{ id: string }>>;
};

export type DomainReconcileResult =
  | { status: "not_found" }
  | {
      status: "unchanged";
      domain: DomainRow;
    }
  | {
      status: "updated";
      domain: DomainRow;
      previousStatus: string;
    };

export type DomainReconcileBatchResult = {
  scanned: number;
  updated: number;
  unchanged: number;
  failed: number;
  changes: Array<{
    domainId: string;
    domainName: string;
    userId: string | null;
    previousStatus: string;
    nextStatus: string;
    records: NonNullable<DomainRow["records"]>;
    capabilities: NonNullable<DomainRow["capabilities"]>;
  }>;
};

export type DomainServiceDependencies = {
  repository?: DomainRepository;
  createDomainIdentity?: (
    domain: string,
    options?: { userId?: string; region?: string },
  ) => Promise<CreateDomainIdentityResult>;
  getDomainIdentity?: (
    domain: string,
    options?: { region?: string },
  ) => Promise<{ verified?: boolean; mailFromDomain?: string | null }>;
  deleteDomainIdentity?: (
    domain: string,
    options?: { region?: string },
  ) => Promise<void>;
  setMailFromDomain?: (
    domain: string,
    mailFromDomain: string,
    options?: { region?: string },
  ) => Promise<void>;
  /**
   * Invalidates dashboard caches after a domain mutation.
   * REQUIRED at construction. The injected implementation MAY no-op when its
   * backing cache is unconfigured (e.g., REDIS_URL unset on a self-host) —
   * correctness is then guaranteed by cache TTL expiry and the manual Verify path.
   */
  invalidateDomainCaches: (params: {
    id?: string | null;
    name?: string | null;
    region?: string | null;
  }) => Promise<void>;
  syncDomainConfigurationSet?: (input: {
    domainId: string;
    tls: string | null | undefined;
    dedicatedIpPoolSesName?: string | null;
    existingConfigSetName?: string | null;
    eventDestinationTopicArn?: string | null;
    region?: string;
  }) => Promise<string>;
};

const defaultCapabilities: DomainCapability[] = [
  { name: "sending", enabled: true },
  { name: "receiving", enabled: false },
];

function normalizeLimit(limit: number | undefined): number {
  return Math.min(Math.max(limit || 20, 1), 100);
}

function buildDomainRecords(
  domainName: string,
  region: string,
  identity: CreateDomainIdentityResult,
  customReturnPath: string | null | undefined,
  trackingSubdomain: string | null | undefined,
): DomainRecord[] {
  const dkimRecords: DomainRecord[] =
    identity.dkimOrigin === "EXTERNAL" &&
    identity.dkimSelector &&
    identity.dkimPublicKey
      ? [
          {
            type: "TXT",
            name: `${identity.dkimSelector}._domainkey.${domainName}`,
            value: `v=DKIM1; k=rsa; p=${identity.dkimPublicKey}`,
            status: "pending",
            ttl: "Auto",
          },
        ]
      : (identity.dkimTokens ?? []).map((token) => ({
          type: "CNAME",
          name: `${token}._domainkey.${domainName}`,
          value: `${token}.dkim.amazonses.com`,
          status: "pending",
          ttl: "Auto",
        }));

  const returnPathRecordName = buildReturnPathRecordName(
    domainName,
    customReturnPath,
  );

  const spfRecord: DomainRecord = {
    type: "TXT",
    name: returnPathRecordName,
    value: "v=spf1 include:amazonses.com ~all",
    status: "pending",
    ttl: "Auto",
  };

  const mxRecord: DomainRecord = {
    type: "MX",
    name: returnPathRecordName,
    value: `feedback-smtp.${region}.amazonses.com`,
    status: "pending",
    ttl: "Auto",
    priority: 10,
  };

  const dmarcRecord: DomainRecord = {
    type: "TXT",
    name: buildDmarcRecordName(domainName),
    value: DMARC_RECORD_VALUE,
    status: "pending",
    ttl: "Auto",
  };

  const trackingCnameRecord = buildTrackingCnameRecord(
    domainName,
    trackingSubdomain,
  );

  return [
    ...dkimRecords,
    spfRecord,
    mxRecord,
    dmarcRecord,
    ...(trackingCnameRecord ? [trackingCnameRecord] : []),
  ];
}

function toDomainDetail(row: DomainRow): DomainDetail {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    region: row.region,
    records: row.records,
    trackOpens: row.trackOpens,
    trackClicks: row.trackClicks,
    trackingSubdomain: row.trackingSubdomain,
    tls: row.tls,
    capabilities: row.capabilities,
    createdAt: row.createdAt,
    customReturnPath: row.customReturnPath,
  };
}

function toDomainServiceListItem(row: DomainRow): DomainServiceListItem {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    region: row.region,
    capabilities: row.capabilities,
    createdAt: row.createdAt,
  };
}

export function createDomainService({
  repository = domainRepo,
  createDomainIdentity = (
    domain: string,
    options?: { userId?: string; region?: string },
  ) => domainIdentityProvider.createDomainIdentity(domain, options),
  getDomainIdentity = (domain: string, options?: { region?: string }) =>
    domainIdentityProvider.getDomainIdentity(domain, options),
  deleteDomainIdentity = (domain: string, options?: { region?: string }) =>
    domainIdentityProvider.deleteDomainIdentity(domain, options),
  setMailFromDomain = (
    domain: string,
    mailFromDomain: string,
    options?: { region?: string },
  ) =>
    domainIdentityProvider.setMailFromDomain(domain, mailFromDomain, options),
  invalidateDomainCaches,
  syncDomainConfigurationSet = (input) =>
    configurationSetService.syncDomainConfigurationSet(input),
}: DomainServiceDependencies) {
  if (!invalidateDomainCaches) {
    throw new Error(
      "createDomainService: invalidateDomainCaches is required — " +
        "domain mutations without cache invalidation cause stale dashboard reads.",
    );
  }

  async function resolveDedicatedIpPoolSesName(
    domain: DomainRow,
  ): Promise<string | null> {
    if (!domain.dedicatedIpPoolId) return null;
    const pool = await dedicatedIpPoolRepo.findById(domain.dedicatedIpPoolId);
    return pool?.sesPoolName ?? null;
  }

  async function syncAndPersistDomainConfigurationSet(
    domain: DomainRow,
  ): Promise<DomainRow> {
    try {
      const configSetName = await syncDomainConfigurationSet({
        domainId: domain.id,
        tls: domain.tls,
        dedicatedIpPoolSesName: await resolveDedicatedIpPoolSesName(domain),
        existingConfigSetName: domain.sesConfigurationSetName ?? null,
        eventDestinationTopicArn: getSesEventsSnsTopicArn(),
        region: domain.region,
      });

      if (domain.sesConfigurationSetName === configSetName) {
        return domain;
      }

      const [updated] = await repository.update(domain.id, {
        sesConfigurationSetName: configSetName,
      });
      if (!updated) return domain;
      return { ...domain, sesConfigurationSetName: configSetName };
    } catch (configErr) {
      // Config-set provisioning failure is non-fatal: callers may already have
      // committed domain state. Log and proceed without claiming provider events.
      console.warn(
        `Failed to sync SES config set for domain ${domain.id}:`,
        configErr,
      );
      return domain;
    }
  }

  /**
   * Point SES's MAIL FROM (envelope/bounce) domain at the return-path
   * subdomain we already ask customers to add DNS records for, so SPF aligns
   * with their domain. Without this call the records are decorative and every
   * send goes out with MAIL FROM = amazonses.com (issue #650).
   *
   * Non-fatal by design: SES falls back to the default MAIL FROM on MX
   * failure, so the worst case equals the previous behavior.
   */
  async function ensureMailFromAttributes(
    domain: Pick<DomainRow, "id" | "name" | "region" | "customReturnPath">,
    currentMailFromDomain?: string | null,
  ): Promise<void> {
    const desired = buildReturnPathRecordName(
      domain.name,
      domain.customReturnPath,
    );
    if (currentMailFromDomain === desired) return;

    try {
      await setMailFromDomain(domain.name, desired, {
        region: domain.region ?? undefined,
      });
    } catch (mailFromErr) {
      console.warn(
        `Failed to set SES MAIL FROM for domain ${domain.id}:`,
        mailFromErr,
      );
    }
  }

  return {
    async listDomains(options: {
      limit?: number;
      after?: string;
      userId: string;
    }): Promise<DomainListResult> {
      const result = await repository.list({
        limit: normalizeLimit(options.limit),
        after: options.after || undefined,
        userId: options.userId,
      });

      return {
        data: result.data.map(toDomainServiceListItem),
        hasMore: result.hasMore,
      };
    },

    async createDomain(input: CreateDomainInput): Promise<DomainDetail> {
      const domainName = input.name.toLowerCase();
      const region = input.region ?? "us-east-1";
      const identity = await createDomainIdentity(domainName, {
        userId: input.userId ?? undefined,
        region,
      });
      const records = buildDomainRecords(
        domainName,
        region,
        identity,
        input.customReturnPath,
        input.trackingSubdomain,
      );

      const dkimOrigin = identity.dkimOrigin ?? "AWS_SES";

      const [row] = await repository.create({
        name: domainName,
        region,
        status: "not_started",
        // Production schema has NOT NULL on dkim_tokens; EXTERNAL rows
        // legitimately have no SES-managed tokens, so insert an empty array.
        dkimTokens: identity.dkimTokens ?? [],
        records,
        customReturnPath: input.customReturnPath ?? null,
        trackOpens: input.openTracking ?? false,
        trackClicks: input.clickTracking ?? false,
        trackingSubdomain: input.trackingSubdomain ?? null,
        tls: input.tls ?? "opportunistic",
        capabilities: input.capabilities ?? defaultCapabilities,
        userId: input.userId ?? null,
        dkimOrigin,
        dkimSelector: identity.dkimSelector ?? null,
        dkimPublicKey: identity.dkimPublicKey ?? null,
        dkimPrivateKeyCt: identity.dkimPrivateKeyEnc?.ct ?? null,
        dkimPrivateKeyIv: identity.dkimPrivateKeyEnc?.iv ?? null,
      });

      const domainWithConfigSet =
        await syncAndPersistDomainConfigurationSet(row);

      // Activate the custom MAIL FROM immediately so SES starts watching the
      // return-path DNS records the customer is about to add.
      await ensureMailFromAttributes(domainWithConfigSet);

      await invalidateDomainCaches({
        id: domainWithConfigSet.id,
        name: domainWithConfigSet.name,
        region: domainWithConfigSet.region,
      });

      return toDomainDetail(domainWithConfigSet);
    },

    async reconcileVerification(id: string): Promise<DomainReconcileResult> {
      const domain = await repository.findById(id);
      if (!domain) return { status: "not_found" };

      const identity = await getDomainIdentity(domain.name, {
        region: domain.region,
      });
      const nextStatus: "pending" | "verified" = identity.verified
        ? "verified"
        : "pending";

      const existingRecords = (domain.records ?? []) as DomainRecord[];
      const recordsForUpdate: DomainRecord[] = existingRecords.map(
        (record) => ({
          ...record,
          status: identity.verified ? "verified" : "pending",
        }),
      );

      const recordsChanged =
        existingRecords.length !== recordsForUpdate.length ||
        existingRecords.some(
          (record, idx) => record.status !== recordsForUpdate[idx].status,
        );
      const statusChanged = domain.status !== nextStatus;

      if (nextStatus === "verified") {
        // Repair pass for identities that predate automatic MAIL FROM
        // activation (or whose SES-side setting drifted).
        await ensureMailFromAttributes(domain, identity.mailFromDomain);
      }

      if (!statusChanged && !recordsChanged) {
        const repairedDomain =
          nextStatus === "verified"
            ? await syncAndPersistDomainConfigurationSet(domain)
            : domain;
        console.log(
          JSON.stringify({
            level: "debug",
            event: "domain.cache.repair_invalidate",
            domain_id: id,
            reason: "reconcile_unchanged_path",
          }),
        );
        await invalidateDomainCaches({
          id,
          name: repairedDomain.name,
          region: repairedDomain.region,
        });
        return { status: "unchanged", domain: repairedDomain };
      }

      const previousStatus = domain.status;
      const [updated] = await repository.update(id, {
        status: nextStatus,
        records: recordsForUpdate,
      });

      if (!updated) {
        await invalidateDomainCaches({
          id,
          name: domain.name,
          region: domain.region,
        });
        return { status: "not_found" };
      }

      const repairedUpdated =
        nextStatus === "verified"
          ? await syncAndPersistDomainConfigurationSet(updated)
          : updated;

      await invalidateDomainCaches({
        id: repairedUpdated.id,
        name: repairedUpdated.name,
        region: repairedUpdated.region,
      });

      if (!statusChanged) {
        return { status: "unchanged", domain: repairedUpdated };
      }

      return {
        status: "updated",
        domain: repairedUpdated,
        previousStatus,
      };
    },

    async verify(id: string) {
      const result = await this.reconcileVerification(id);
      if (result.status === "not_found") {
        throw new Error("Domain not found");
      }
      return [result.domain];
    },

    async reconcileAllPendingVerifications(
      options: { limit?: number } = {},
    ): Promise<DomainReconcileBatchResult> {
      const pending = await repository.listPendingVerification({
        limit: options.limit,
      });

      const result: DomainReconcileBatchResult = {
        scanned: pending.length,
        updated: 0,
        unchanged: 0,
        failed: 0,
        changes: [],
      };

      for (const domain of pending) {
        try {
          const reconciled = await this.reconcileVerification(domain.id);
          if (reconciled.status === "updated") {
            result.updated++;
            result.changes.push({
              domainId: reconciled.domain.id,
              domainName: reconciled.domain.name,
              userId: reconciled.domain.userId ?? null,
              previousStatus: reconciled.previousStatus,
              nextStatus: reconciled.domain.status,
              records: reconciled.domain.records ?? [],
              capabilities: reconciled.domain.capabilities ?? [],
            });
          } else if (reconciled.status === "unchanged") {
            result.unchanged++;
          } else {
            result.failed++;
          }
        } catch {
          result.failed++;
        }
      }

      return result;
    },

    async delete(id: string) {
      const domain = await repository.findById(id);
      if (domain) {
        await deleteDomainIdentity(domain.name, { region: domain.region });
      }
      return await repository.delete(id);
    },
  };
}
