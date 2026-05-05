import { domainRepo } from "../db/repositories/domainRepo";
import type { domains } from "../db/schema";
import { emailProvider } from "./emailProvider";

type DomainRow = typeof domains.$inferSelect;
type DomainInsert = typeof domains.$inferInsert;

type DomainRecord = NonNullable<DomainRow["records"]>[number];
type DomainCapability = NonNullable<DomainRow["capabilities"]>[number];

export const DEFAULT_RETURN_PATH = "send";
export const DMARC_RECORD_VALUE = "v=DMARC1; p=none;";

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

export type CreateDomainIdentityResult = {
  dkimTokens: string[];
  status?: string;
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
  create(data: DomainInsert): Promise<DomainRow[]>;
  findById(id: string): Promise<DomainRow | undefined>;
  update(id: string, data: Partial<DomainInsert>): Promise<DomainRow[]>;
  delete(id: string): Promise<Array<{ id: string }>>;
};

export type DomainServiceDependencies = {
  repository?: DomainRepository;
  createDomainIdentity?: (
    domain: string,
  ) => Promise<CreateDomainIdentityResult>;
  getDomainIdentity?: (domain: string) => Promise<{ verified?: boolean }>;
  deleteDomainIdentity?: (domain: string) => Promise<void>;
  invalidateDomainCaches?: (domain: {
    id: string;
    name: string;
  }) => Promise<void>;
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
  dkimTokens: string[],
  customReturnPath: string | null | undefined,
): DomainRecord[] {
  const dkimRecords: DomainRecord[] = dkimTokens.map((token) => ({
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

  return [...dkimRecords, spfRecord, mxRecord, dmarcRecord];
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
  createDomainIdentity = (domain: string) =>
    emailProvider.createDomainIdentity(domain).then((result) => ({
      dkimTokens: result.dkimTokens ?? [],
    })),
  getDomainIdentity = (domain: string) =>
    emailProvider.getDomainIdentity(domain),
  deleteDomainIdentity = (domain: string) =>
    emailProvider.deleteDomainIdentity(domain),
  invalidateDomainCaches = async () => {},
}: DomainServiceDependencies = {}) {
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
      const identity = await createDomainIdentity(domainName);
      const records = buildDomainRecords(
        domainName,
        region,
        identity.dkimTokens,
        input.customReturnPath,
      );

      const [row] = await repository.create({
        name: domainName,
        region,
        status: "not_started",
        dkimTokens: identity.dkimTokens,
        records,
        customReturnPath: input.customReturnPath ?? null,
        trackOpens: input.openTracking ?? false,
        trackClicks: input.clickTracking ?? false,
        trackingSubdomain: input.trackingSubdomain ?? null,
        tls: input.tls ?? "opportunistic",
        capabilities: input.capabilities ?? defaultCapabilities,
        userId: input.userId ?? null,
      });

      await invalidateDomainCaches({ id: row.id, name: row.name });

      return toDomainDetail(row);
    },

    async verify(id: string) {
      const domain = await repository.findById(id);
      if (!domain) throw new Error("Domain not found");

      const identity = await getDomainIdentity(domain.name);
      const status: "pending" | "verified" | "failed" = identity.verified
        ? "verified"
        : "pending";

      return await repository.update(id, { status });
    },

    async delete(id: string) {
      const domain = await repository.findById(id);
      if (domain) {
        await deleteDomainIdentity(domain.name);
      }
      return await repository.delete(id);
    },
  };
}

export class DomainService {
  private readonly service: ReturnType<typeof createDomainService>;

  constructor(dependencies: DomainServiceDependencies = {}) {
    this.service = createDomainService(dependencies);
  }

  async create(params: { name: string; region?: string }) {
    return await this.service.createDomain(params);
  }

  async verify(id: string) {
    return await this.service.verify(id);
  }

  async delete(id: string) {
    return await this.service.delete(id);
  }
}

export const domainService = createDomainService();
