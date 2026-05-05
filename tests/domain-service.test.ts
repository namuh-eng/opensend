import { describe, expect, it, vi } from "vitest";
import {
  type DomainRepository,
  createDomainService,
} from "../packages/core/src/services/domain";

type DomainRow = NonNullable<Awaited<ReturnType<DomainRepository["findById"]>>>;
type DomainInsert = Parameters<DomainRepository["create"]>[0];

function domainRow(overrides: Partial<DomainRow> = {}): DomainRow {
  return {
    id: "domain-1",
    name: "example.com",
    status: "not_started",
    region: "us-east-1",
    dkimTokens: ["token-1", "token-2", "token-3"],
    records: [],
    trackClicks: false,
    trackOpens: false,
    tls: "opportunistic",
    createdAt: new Date("2026-05-03T00:00:00.000Z"),
    document: null,
    userId: "user-1",
    customReturnPath: null,
    trackingSubdomain: null,
    capabilities: [{ name: "sending", enabled: true }],
    ...overrides,
  };
}

function createRepository(overrides: Partial<DomainRepository> = {}) {
  const repository: DomainRepository = {
    async list() {
      return { data: [], hasMore: false };
    },
    async create(data: DomainInsert) {
      return [domainRow({ ...data, id: "created-domain" })];
    },
    async findById() {
      return domainRow();
    },
    async update(id, data) {
      return [domainRow({ id, ...data })];
    },
    async delete(id: string) {
      return [{ id }];
    },
    ...overrides,
  };

  return repository;
}

describe("domain service", () => {
  it("creates a domain identity, persists SES DNS records, and invalidates caches", async () => {
    const inserted: DomainInsert[] = [];
    const createDomainIdentity = vi.fn(async () => ({
      dkimTokens: ["dkim-a", "dkim-b"],
      status: "PENDING",
    }));
    const invalidateDomainCaches =
      vi.fn<(_: { id: string; name: string }) => Promise<void>>();
    const repository = createRepository({
      async create(data) {
        inserted.push(data);
        return [
          domainRow({
            ...data,
            id: "created-domain",
            createdAt: new Date("2026-05-03T00:00:00.000Z"),
          }),
        ];
      },
    });

    const service = createDomainService({
      repository,
      createDomainIdentity,
      invalidateDomainCaches,
    });

    const result = await service.createDomain({
      name: "Example.COM",
      region: "eu-west-1",
      customReturnPath: "outbound",
      openTracking: true,
      clickTracking: true,
      trackingSubdomain: "track.example.com",
      tls: "enforced",
      capabilities: [{ name: "sending", enabled: false }],
      userId: "user-1",
    });

    expect(createDomainIdentity).toHaveBeenCalledWith("example.com");
    expect(inserted[0]).toMatchObject({
      name: "example.com",
      region: "eu-west-1",
      status: "not_started",
      dkimTokens: ["dkim-a", "dkim-b"],
      customReturnPath: "outbound",
      trackOpens: true,
      trackClicks: true,
      trackingSubdomain: "track.example.com",
      tls: "enforced",
      capabilities: [{ name: "sending", enabled: false }],
      userId: "user-1",
    });
    expect(inserted[0]?.records).toEqual([
      {
        type: "CNAME",
        name: "dkim-a._domainkey.example.com",
        value: "dkim-a.dkim.amazonses.com",
        status: "pending",
        ttl: "Auto",
      },
      {
        type: "CNAME",
        name: "dkim-b._domainkey.example.com",
        value: "dkim-b.dkim.amazonses.com",
        status: "pending",
        ttl: "Auto",
      },
      {
        type: "TXT",
        name: "outbound.example.com",
        value: "v=spf1 include:amazonses.com ~all",
        status: "pending",
        ttl: "Auto",
      },
      {
        type: "MX",
        name: "outbound.example.com",
        value: "feedback-smtp.eu-west-1.amazonses.com",
        status: "pending",
        ttl: "Auto",
        priority: 10,
      },
      {
        type: "TXT",
        name: "_dmarc.example.com",
        value: "v=DMARC1; p=none;",
        status: "pending",
        ttl: "Auto",
      },
    ]);
    expect(result).toMatchObject({
      id: "created-domain",
      name: "example.com",
      region: "eu-west-1",
      customReturnPath: "outbound",
      trackOpens: true,
      trackClicks: true,
    });
    expect(invalidateDomainCaches).toHaveBeenCalledWith({
      id: "created-domain",
      name: "example.com",
    });
  });

  it("uses external API defaults when optional create fields are omitted", async () => {
    const inserted: DomainInsert[] = [];
    const service = createDomainService({
      repository: createRepository({
        async create(data) {
          inserted.push(data);
          return [domainRow({ ...data })];
        },
      }),
      createDomainIdentity: async () => ({ dkimTokens: [] }),
    });

    await service.createDomain({ name: "example.com" });

    expect(inserted[0]).toMatchObject({
      region: "us-east-1",
      status: "not_started",
      customReturnPath: null,
      trackOpens: false,
      trackClicks: false,
      trackingSubdomain: null,
      tls: "opportunistic",
      capabilities: [
        { name: "sending", enabled: true },
        { name: "receiving", enabled: false },
      ],
      userId: null,
    });
    expect(inserted[0]?.records).toEqual([
      {
        type: "TXT",
        name: "send.example.com",
        value: "v=spf1 include:amazonses.com ~all",
        status: "pending",
        ttl: "Auto",
      },
      {
        type: "MX",
        name: "send.example.com",
        value: "feedback-smtp.us-east-1.amazonses.com",
        status: "pending",
        ttl: "Auto",
        priority: 10,
      },
      {
        type: "TXT",
        name: "_dmarc.example.com",
        value: "v=DMARC1; p=none;",
        status: "pending",
        ttl: "Auto",
      },
    ]);
  });

  it("lists with normalized pagination and maps public list fields", async () => {
    let listOptions: {
      limit?: number;
      after?: string;
      userId?: string | null;
    } | null = null;
    const service = createDomainService({
      repository: createRepository({
        async list(options) {
          listOptions = options;
          return {
            data: [domainRow({ id: "domain-2", name: "two.example" })],
            hasMore: true,
          };
        },
      }),
    });

    const result = await service.listDomains({
      limit: 500,
      after: "domain-3",
      userId: "user-1",
    });

    expect(listOptions).toEqual({
      limit: 100,
      after: "domain-3",
      userId: "user-1",
    });
    expect(result).toEqual({
      data: [
        {
          id: "domain-2",
          name: "two.example",
          status: "not_started",
          region: "us-east-1",
          capabilities: [{ name: "sending", enabled: true }],
          createdAt: new Date("2026-05-03T00:00:00.000Z"),
        },
      ],
      hasMore: true,
    });
  });
});
