import { and, eq } from "drizzle-orm";
import { db } from "../db/client";
import { domainRepo } from "../db/repositories/domainRepo";
import { domains } from "../db/schema";
import { getEffectiveReturnPathLabel } from "./domain";
import { emailProvider } from "./emailProvider";

type DomainRow = typeof domains.$inferSelect;
type DomainInsert = typeof domains.$inferInsert;
type DomainRecord = NonNullable<DomainRow["records"]>[number];
type DomainCapability = NonNullable<DomainRow["capabilities"]>[number];

type DomainDetailUpdateData = Partial<
  Pick<
    DomainInsert,
    "trackClicks" | "trackOpens" | "trackingSubdomain" | "capabilities" | "tls"
  >
>;

export type DomainDetailResponse = {
  object: "domain";
  id: string;
  name: string;
  status: string;
  region: string;
  records: DomainRecord[];
  custom_return_path: string | null;
  return_path: string;
  open_tracking: boolean;
  click_tracking: boolean;
  tracking_subdomain: string | null;
  tls: string;
  capabilities: DomainCapability[] | null;
  created_at: DomainRow["createdAt"];
};

export type UpdateDomainDetailInput = {
  click_tracking?: boolean;
  open_tracking?: boolean;
  tracking_subdomain?: string;
  capabilities?: DomainCapability[];
  sending_enabled?: boolean;
  receiving_enabled?: boolean;
  tls?: string;
};

export type DomainDetailMutationResponse = {
  object: "domain";
  id: string;
};

export type DomainDetailDeleteResponse = DomainDetailMutationResponse & {
  deleted: true;
};

export type DomainDetailWebhookPayload = {
  id: string;
  name: string;
  status: string;
  region: string;
  records: DomainRecord[];
  capabilities: DomainCapability[];
  created_at: string | Date;
};

export type DomainDetailUpdateResult = {
  response: DomainDetailMutationResponse;
  changedFields: string[];
  eventPayload?: {
    id: string;
    changed_fields: string[];
    domain: DomainDetailWebhookPayload;
  };
};

export type DomainDetailDeleteResult = {
  response: DomainDetailDeleteResponse;
  eventPayload: {
    id: string;
    name: string;
  };
};

export type DomainDetailDnsRecord = {
  id: string;
  name: string;
  content: string;
};

export type DomainDetailServiceErrorCode = "not_found";

export class DomainDetailServiceError extends Error {
  constructor(
    readonly code: DomainDetailServiceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "DomainDetailServiceError";
  }
}

export type DomainDetailServiceDependencies = {
  getDomainById?: (id: string) => Promise<DomainRow | null | undefined>;
  updateDomainForUser?: (input: {
    id: string;
    userId: string;
    updates: DomainDetailUpdateData;
  }) => Promise<DomainRow | undefined>;
  deleteDomainForUser?: (input: {
    id: string;
    userId: string;
  }) => Promise<{ id: string; name: string } | undefined>;
  deleteDomainIdentity?: (domain: string) => Promise<void>;
  listDNSRecords?: (input: { name: string }) => Promise<
    DomainDetailDnsRecord[]
  >;
  deleteDNSRecord?: (id: string) => Promise<void>;
  invalidateDomainCaches?: (domain: {
    id?: string | null;
    name?: string | null;
  }) => Promise<void>;
  logger?: Pick<Console, "warn">;
};

const defaultCapabilities: DomainCapability[] = [
  { name: "sending", enabled: true },
  { name: "receiving", enabled: false },
];

async function defaultUpdateDomainForUser(input: {
  id: string;
  userId: string;
  updates: DomainDetailUpdateData;
}): Promise<DomainRow | undefined> {
  const [updated] = await db
    .update(domains)
    .set(input.updates)
    .where(and(eq(domains.id, input.id), eq(domains.userId, input.userId)))
    .returning();

  return updated;
}

async function defaultDeleteDomainForUser(input: {
  id: string;
  userId: string;
}): Promise<{ id: string; name: string } | undefined> {
  const [deleted] = await db
    .delete(domains)
    .where(and(eq(domains.id, input.id), eq(domains.userId, input.userId)))
    .returning({ id: domains.id, name: domains.name });

  return deleted;
}

function toDomainWebhookPayload(domain: DomainRow): DomainDetailWebhookPayload {
  return {
    id: domain.id,
    name: domain.name,
    status: domain.status,
    region: domain.region,
    records: domain.records ?? [],
    capabilities: domain.capabilities ?? [],
    created_at:
      domain.createdAt instanceof Date
        ? domain.createdAt.toISOString()
        : domain.createdAt,
  };
}

function toDomainDetailResponse(domain: DomainRow): DomainDetailResponse {
  return {
    object: "domain",
    id: domain.id,
    name: domain.name,
    status: domain.status,
    region: domain.region,
    records: domain.records || [],
    custom_return_path: domain.customReturnPath,
    return_path: getEffectiveReturnPathLabel(domain.customReturnPath),
    open_tracking: domain.trackOpens,
    click_tracking: domain.trackClicks,
    tracking_subdomain: domain.trackingSubdomain,
    tls: domain.tls,
    capabilities: domain.capabilities,
    created_at: domain.createdAt,
  };
}

function valuesEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

function toUpdateData(
  input: UpdateDomainDetailInput,
  existingDomain: DomainRow,
): DomainDetailUpdateData {
  const updates: DomainDetailUpdateData = {};

  if (input.click_tracking !== undefined) {
    updates.trackClicks = input.click_tracking;
  }
  if (input.open_tracking !== undefined) {
    updates.trackOpens = input.open_tracking;
  }
  if (input.tracking_subdomain !== undefined) {
    updates.trackingSubdomain = input.tracking_subdomain;
  }

  if (input.capabilities !== undefined) {
    updates.capabilities = input.capabilities;
  } else if (
    input.sending_enabled !== undefined ||
    input.receiving_enabled !== undefined
  ) {
    const currentCaps = existingDomain.capabilities || defaultCapabilities;
    updates.capabilities = currentCaps.map((cap) => {
      if (cap.name === "sending" && input.sending_enabled !== undefined) {
        return { ...cap, enabled: input.sending_enabled };
      }
      if (cap.name === "receiving" && input.receiving_enabled !== undefined) {
        return { ...cap, enabled: input.receiving_enabled };
      }
      return cap;
    });
  }

  if (input.tls !== undefined) {
    updates.tls = input.tls;
  }

  return updates;
}

function currentValueForField(domain: DomainRow, field: string): unknown {
  if (field === "open_tracking") return domain.trackOpens;
  if (field === "click_tracking") return domain.trackClicks;
  if (field === "tracking_subdomain") return domain.trackingSubdomain;
  if (field === "capabilities") return domain.capabilities;
  return domain.tls;
}

function getChangedFields(
  existingDomain: DomainRow,
  updates: DomainDetailUpdateData,
): string[] {
  return Object.entries({
    open_tracking: updates.trackOpens,
    click_tracking: updates.trackClicks,
    tracking_subdomain: updates.trackingSubdomain,
    capabilities: updates.capabilities,
    tls: updates.tls,
  })
    .filter(([, value]) => value !== undefined)
    .filter(
      ([field, value]) =>
        !valuesEqual(currentValueForField(existingDomain, field), value),
    )
    .map(([field]) => field);
}

function shouldCleanupDnsRecord(record: DomainDetailDnsRecord): boolean {
  return (
    record.content.includes("amazonses.com") ||
    record.name.includes("_domainkey") ||
    record.content.startsWith("v=spf1")
  );
}

export function createDomainDetailService({
  getDomainById = (id: string) => domainRepo.findById(id),
  updateDomainForUser = defaultUpdateDomainForUser,
  deleteDomainForUser = defaultDeleteDomainForUser,
  deleteDomainIdentity = (domain: string) =>
    emailProvider.deleteDomainIdentity(domain),
  listDNSRecords = async () => [],
  deleteDNSRecord = async () => {},
  invalidateDomainCaches = async () => {},
  logger = console,
}: DomainDetailServiceDependencies = {}) {
  async function getExistingForUser(
    id: string,
    userId: string,
  ): Promise<DomainRow> {
    const domain = await getDomainById(id);

    if (!domain || domain.userId !== userId) {
      throw new DomainDetailServiceError("not_found", "Not found");
    }

    return domain;
  }

  return {
    async getDomainDetail(input: {
      id: string;
      userId: string;
    }): Promise<DomainDetailResponse> {
      const domain = await getExistingForUser(input.id, input.userId);
      return toDomainDetailResponse(domain);
    },

    async updateDomainDetail(input: {
      id: string;
      userId: string;
      updates: UpdateDomainDetailInput;
    }): Promise<DomainDetailUpdateResult> {
      const existingDomain = await getExistingForUser(input.id, input.userId);
      const updates = toUpdateData(input.updates, existingDomain);
      const changedFields = getChangedFields(existingDomain, updates);

      if (changedFields.length === 0) {
        return {
          response: {
            object: "domain",
            id: existingDomain.id,
          },
          changedFields,
        };
      }

      const updated = await updateDomainForUser({
        id: input.id,
        userId: input.userId,
        updates,
      });

      if (!updated) {
        await invalidateDomainCaches({
          id: input.id,
          name: existingDomain.name,
        });
        throw new DomainDetailServiceError("not_found", "Not found");
      }

      await invalidateDomainCaches({ id: updated.id, name: updated.name });

      return {
        response: {
          object: "domain",
          id: updated.id,
        },
        changedFields,
        eventPayload: {
          id: updated.id,
          changed_fields: changedFields,
          domain: toDomainWebhookPayload(updated),
        },
      };
    },

    async deleteDomainDetail(input: {
      id: string;
      userId: string;
    }): Promise<DomainDetailDeleteResult> {
      const domain = await getExistingForUser(input.id, input.userId);

      try {
        await deleteDomainIdentity(domain.name);
      } catch (sesErr) {
        logger.warn(
          `Failed to delete SES identity for ${domain.name}:`,
          sesErr,
        );
      }

      try {
        const records = await listDNSRecords({ name: domain.name });
        const sesRecords = records.filter(shouldCleanupDnsRecord);

        await Promise.all(
          sesRecords.map((record) => deleteDNSRecord(record.id)),
        );
      } catch (cfErr) {
        logger.warn(
          `Failed to cleanup Cloudflare records for ${domain.name}:`,
          cfErr,
        );
      }

      const deleted = await deleteDomainForUser({
        id: input.id,
        userId: input.userId,
      });

      await invalidateDomainCaches({ id: input.id, name: domain.name });

      if (!deleted) {
        throw new DomainDetailServiceError("not_found", "Not found");
      }

      return {
        response: {
          object: "domain",
          id: deleted.id,
          deleted: true,
        },
        eventPayload: {
          id: deleted.id,
          name: deleted.name,
        },
      };
    },
  };
}

export const domainDetailService = createDomainDetailService();
