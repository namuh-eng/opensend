import { describe, expect, it, vi } from "vitest";
import {
  type DomainRepository,
  createDomainService,
} from "../packages/core/src/services/domain";
import { domainIdentityProvider } from "../packages/core/src/services/domain-providers";

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
    dkimOrigin: "AWS_SES",
    dkimSelector: null,
    dkimPublicKey: null,
    dkimPrivateKeyCt: null,
    dkimPrivateKeyIv: null,
    dedicatedIpPoolId: null,
    sesConfigurationSetName: null,
    ...overrides,
  };
}

function createRepository(overrides: Partial<DomainRepository> = {}) {
  const repository: DomainRepository = {
    async list() {
      return { data: [], hasMore: false };
    },
    async listPendingVerification() {
      return [];
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
  it("createDomainService({}) throws containing 'invalidateDomainCaches'", () => {
    expect(() =>
      createDomainService({} as Parameters<typeof createDomainService>[0]),
    ).toThrow("invalidateDomainCaches");
  });

  it("uses the core domain identity provider when route adapters do not inject SES", async () => {
    const inserted: DomainInsert[] = [];
    const createDomainIdentity = vi
      .spyOn(domainIdentityProvider, "createDomainIdentity")
      .mockResolvedValueOnce({
        dkimOrigin: "EXTERNAL",
        status: "PENDING",
        dkimSelector: "opensend-test",
        dkimPublicKey: "public-key",
        dkimPrivateKeyEnc: { ct: "ciphertext", iv: "iv" },
      });
    const setMailFromDomain = vi
      .spyOn(domainIdentityProvider, "setMailFromDomain")
      .mockResolvedValue(undefined);
    const repository = createRepository({
      async create(data) {
        inserted.push(data);
        return [domainRow({ ...data, id: "created-domain" })];
      },
    });

    try {
      const service = createDomainService({
        repository,
        invalidateDomainCaches: vi.fn(),
        syncDomainConfigurationSet: vi.fn(async () => "cfg-created-domain"),
      });
      await service.createDomain({ name: "Example.COM", userId: "user-1" });

      expect(createDomainIdentity).toHaveBeenCalledWith("example.com", {
        userId: "user-1",
        region: "us-east-1",
      });
      expect(inserted[0]).toMatchObject({
        name: "example.com",
        dkimOrigin: "EXTERNAL",
        dkimSelector: "opensend-test",
        dkimPublicKey: "public-key",
        dkimPrivateKeyCt: "ciphertext",
        dkimPrivateKeyIv: "iv",
      });
      expect(inserted[0]?.records).toContainEqual({
        type: "TXT",
        name: "opensend-test._domainkey.example.com",
        value: "v=DKIM1; k=rsa; p=public-key",
        status: "pending",
        ttl: "Auto",
      });
      expect(setMailFromDomain).toHaveBeenCalledWith(
        "example.com",
        "send.example.com",
        { region: "us-east-1" },
      );
    } finally {
      createDomainIdentity.mockRestore();
      setMailFromDomain.mockRestore();
    }
  });

  it("creates a domain identity, persists SES DNS records, and invalidates caches", async () => {
    const inserted: DomainInsert[] = [];
    const createDomainIdentity = vi.fn(async () => ({
      dkimTokens: ["dkim-a", "dkim-b"],
      status: "PENDING",
    }));
    const invalidateDomainCaches =
      vi.fn<
        (params: {
          id?: string | null;
          name?: string | null;
          region?: string | null;
        }) => Promise<void>
      >();
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

    const setMailFromDomain = vi.fn(async () => undefined);
    const service = createDomainService({
      repository,
      createDomainIdentity,
      setMailFromDomain,
      invalidateDomainCaches,
      syncDomainConfigurationSet: vi.fn(async () => "cfg-created-domain"),
    });

    const previousTrackingTarget = process.env.TRACKING_CNAME_TARGET;
    process.env.TRACKING_CNAME_TARGET = "track.opensend.example";
    const result = await service.createDomain({
      name: "Example.COM",
      region: "eu-west-1",
      customReturnPath: "outbound",
      openTracking: true,
      clickTracking: true,
      trackingSubdomain: "links",
      tls: "enforced",
      capabilities: [{ name: "sending", enabled: false }],
      userId: "user-1",
    });
    if (previousTrackingTarget === undefined) {
      process.env.TRACKING_CNAME_TARGET = undefined;
    } else {
      process.env.TRACKING_CNAME_TARGET = previousTrackingTarget;
    }

    expect(createDomainIdentity).toHaveBeenCalledWith("example.com", {
      userId: "user-1",
      region: "eu-west-1",
    });
    // Custom return path label drives the MAIL FROM subdomain.
    expect(setMailFromDomain).toHaveBeenCalledWith(
      "example.com",
      "outbound.example.com",
      { region: "eu-west-1" },
    );
    expect(inserted[0]).toMatchObject({
      name: "example.com",
      region: "eu-west-1",
      status: "not_started",
      dkimTokens: ["dkim-a", "dkim-b"],
      customReturnPath: "outbound",
      trackOpens: true,
      trackClicks: true,
      trackingSubdomain: "links",
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
      {
        type: "CNAME",
        name: "links.example.com",
        value: "track.opensend.example",
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
      region: "eu-west-1",
    });
  });

  it("passes the SES events topic ARN into config-set sync and persists the returned name", async () => {
    const previousTopicArn = process.env.SES_EVENTS_SNS_TOPIC_ARN;
    process.env.SES_EVENTS_SNS_TOPIC_ARN =
      "arn:aws:sns:us-east-1:123456789012:opensend-ses-events";
    const updates: Array<{ id: string; data: Partial<DomainInsert> }> = [];
    const syncDomainConfigurationSet = vi.fn(async () => "cfg-created-domain");
    const repository = createRepository({
      async create(data) {
        return [domainRow({ ...data, id: "created-domain" })];
      },
      async update(id, data) {
        updates.push({ id, data });
        return [domainRow({ id, ...data })];
      },
    });
    const service = createDomainService({
      setMailFromDomain: vi.fn(async () => undefined),
      repository,
      createDomainIdentity: async () => ({ dkimTokens: [] }),
      invalidateDomainCaches: vi.fn(),
      syncDomainConfigurationSet,
    });

    try {
      await service.createDomain({
        name: "example.com",
        userId: "user-1",
      });

      expect(syncDomainConfigurationSet).toHaveBeenCalledWith({
        domainId: "created-domain",
        tls: "opportunistic",
        dedicatedIpPoolSesName: null,
        existingConfigSetName: null,
        eventDestinationTopicArn:
          "arn:aws:sns:us-east-1:123456789012:opensend-ses-events",
        region: "us-east-1",
      });
      expect(updates).toEqual([
        {
          id: "created-domain",
          data: { sesConfigurationSetName: "cfg-created-domain" },
        },
      ]);
    } finally {
      if (previousTopicArn === undefined) {
        process.env.SES_EVENTS_SNS_TOPIC_ARN = "";
      } else {
        process.env.SES_EVENTS_SNS_TOPIC_ARN = previousTopicArn;
      }
    }
  });

  it("uses external API defaults when optional create fields are omitted", async () => {
    const inserted: DomainInsert[] = [];
    const service = createDomainService({
      setMailFromDomain: vi.fn(async () => undefined),
      repository: createRepository({
        async create(data) {
          inserted.push(data);
          return [domainRow({ ...data })];
        },
      }),
      createDomainIdentity: async () => ({ dkimTokens: [] }),
      invalidateDomainCaches: vi.fn(),
      syncDomainConfigurationSet: vi.fn(async () => "cfg-domain-1"),
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

  it("reconciles verification: maps records[].status from identity.verified", async () => {
    const updates: Array<{ id: string; data: Partial<DomainInsert> }> = [];
    const existingDomain = domainRow({
      id: "dom-1",
      name: "example.com",
      region: "ap-northeast-1",
      status: "pending",
      records: [
        {
          type: "TXT",
          name: "_dmarc.example.com",
          value: "v=DMARC1; p=none;",
          status: "pending",
          ttl: "Auto",
        },
        {
          type: "TXT",
          name: "send.example.com",
          value: "v=spf1 include:amazonses.com ~all",
          status: "pending",
          ttl: "Auto",
        },
      ],
    });
    const getDomainIdentity = vi.fn(async () => ({ verified: true }));
    const syncDomainConfigurationSet = vi.fn(async () => "cfg-dom-1");
    const repository = createRepository({
      async findById() {
        return existingDomain;
      },
      async update(id, data) {
        updates.push({ id, data });
        return [domainRow({ ...existingDomain, ...data })];
      },
    });

    const service = createDomainService({
      setMailFromDomain: vi.fn(async () => undefined),
      repository,
      getDomainIdentity,
      invalidateDomainCaches: vi.fn(),
      syncDomainConfigurationSet,
    });

    const result = await service.reconcileVerification("dom-1");

    expect(getDomainIdentity).toHaveBeenCalledWith("example.com", {
      region: "ap-northeast-1",
    });
    expect(result.status).toBe("updated");
    expect(updates).toHaveLength(2);
    expect(updates[0].data.status).toBe("verified");
    expect(updates[0].data.records).toEqual([
      expect.objectContaining({
        name: "_dmarc.example.com",
        status: "verified",
      }),
      expect.objectContaining({
        name: "send.example.com",
        status: "verified",
      }),
    ]);
    expect(updates[1]).toEqual({
      id: "dom-1",
      data: { sesConfigurationSetName: "cfg-dom-1" },
    });
    if (result.status === "updated") {
      expect(result.previousStatus).toBe("pending");
      expect(result.domain.status).toBe("verified");
      expect(result.domain.sesConfigurationSetName).toBe("cfg-dom-1");
    }
  });

  it("repairs verified domains by writing back the authoritative config-set name", async () => {
    const previousTopicArn = process.env.SES_EVENTS_SNS_TOPIC_ARN;
    process.env.SES_EVENTS_SNS_TOPIC_ARN =
      "arn:aws:sns:us-east-1:123456789012:opensend-ses-events";
    const updates: Array<{ id: string; data: Partial<DomainInsert> }> = [];
    const existingDomain = domainRow({
      id: "dom-repair",
      name: "example.com",
      status: "verified",
      sesConfigurationSetName: null,
    });
    const syncDomainConfigurationSet = vi.fn(
      async () => "opensend-domain-dom-repair",
    );
    const repository = createRepository({
      async findById() {
        return existingDomain;
      },
      async update(id, data) {
        updates.push({ id, data });
        return [domainRow({ ...existingDomain, ...data })];
      },
    });
    const service = createDomainService({
      setMailFromDomain: vi.fn(async () => undefined),
      repository,
      getDomainIdentity: async () => ({ verified: true }),
      invalidateDomainCaches: vi.fn(),
      syncDomainConfigurationSet,
    });

    try {
      const result = await service.reconcileVerification("dom-repair");

      expect(result.status).toBe("unchanged");
      expect(syncDomainConfigurationSet).toHaveBeenCalledWith({
        domainId: "dom-repair",
        tls: "opportunistic",
        dedicatedIpPoolSesName: null,
        existingConfigSetName: null,
        eventDestinationTopicArn:
          "arn:aws:sns:us-east-1:123456789012:opensend-ses-events",
        region: "us-east-1",
      });
      expect(updates).toEqual([
        {
          id: "dom-repair",
          data: { sesConfigurationSetName: "opensend-domain-dom-repair" },
        },
      ]);
      if (result.status === "unchanged") {
        expect(result.domain.sesConfigurationSetName).toBe(
          "opensend-domain-dom-repair",
        );
      }
    } finally {
      if (previousTopicArn === undefined) {
        process.env.SES_EVENTS_SNS_TOPIC_ARN = "";
      } else {
        process.env.SES_EVENTS_SNS_TOPIC_ARN = previousTopicArn;
      }
    }
  });

  it("reconciles verification: returns unchanged when status and records are stable — invalidates caches on unchanged path", async () => {
    const updates: Array<{ id: string; data: Partial<DomainInsert> }> = [];
    const existingDomain = domainRow({
      id: "dom-2",
      name: "example.com",
      region: "us-east-1",
      status: "pending",
      records: [
        {
          type: "TXT",
          name: "_dmarc.example.com",
          value: "v=DMARC1; p=none;",
          status: "pending",
          ttl: "Auto",
        },
      ],
    });
    const repository = createRepository({
      async findById() {
        return existingDomain;
      },
      async update(id, data) {
        updates.push({ id, data });
        return [domainRow({ ...existingDomain, ...data })];
      },
    });
    const invalidateDomainCaches =
      vi.fn<
        (params: {
          id?: string | null;
          name?: string | null;
          region?: string | null;
        }) => Promise<void>
      >();

    const service = createDomainService({
      setMailFromDomain: vi.fn(async () => undefined),
      repository,
      getDomainIdentity: async () => ({ verified: false }),
      invalidateDomainCaches,
    });

    const result = await service.reconcileVerification("dom-2");

    expect(result.status).toBe("unchanged");
    expect(updates).toHaveLength(0);
    // The unchanged path now calls invalidateDomainCaches once as a cache-repair
    // step to fix stale entries that might have been set before the last update.
    expect(invalidateDomainCaches).toHaveBeenCalledOnce();
    expect(invalidateDomainCaches).toHaveBeenCalledWith({
      id: "dom-2",
      name: "example.com",
      region: "us-east-1",
    });
  });

  it("reconcileAllPendingVerifications: tolerates per-domain failures", async () => {
    const pendingA = domainRow({
      id: "dom-a",
      name: "a.example",
      status: "not_started",
      userId: "user-a",
      records: [],
    });
    const pendingB = domainRow({
      id: "dom-b",
      name: "b.example",
      status: "pending",
      userId: "user-b",
      records: [],
    });

    const repository = createRepository({
      async listPendingVerification() {
        return [pendingA, pendingB];
      },
      async findById(id) {
        return id === "dom-a" ? pendingA : pendingB;
      },
      async update(id, data) {
        return [
          domainRow({
            ...(id === "dom-a" ? pendingA : pendingB),
            ...data,
          }),
        ];
      },
    });

    const service = createDomainService({
      setMailFromDomain: vi.fn(async () => undefined),
      repository,
      getDomainIdentity: async (name) => {
        if (name === "a.example") return { verified: true };
        throw new Error("ses unavailable");
      },
      invalidateDomainCaches: vi.fn(),
      syncDomainConfigurationSet: vi.fn(async () => "cfg-reconciled-domain"),
    });

    const result = await service.reconcileAllPendingVerifications();

    expect(result.scanned).toBe(2);
    expect(result.updated).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.changes).toHaveLength(1);
    expect(result.changes[0]).toMatchObject({
      domainId: "dom-a",
      domainName: "a.example",
      userId: "user-a",
      previousStatus: "not_started",
      nextStatus: "verified",
    });
  });

  it("lists with normalized pagination and maps public list fields", async () => {
    let listOptions: {
      limit?: number;
      after?: string;
      userId?: string | null;
    } | null = null;
    const service = createDomainService({
      setMailFromDomain: vi.fn(async () => undefined),
      repository: createRepository({
        async list(options) {
          listOptions = options;
          return {
            data: [domainRow({ id: "domain-2", name: "two.example" })],
            hasMore: true,
          };
        },
      }),
      invalidateDomainCaches: vi.fn(),
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

  it("reconcileVerification activates MAIL FROM on verified identities that lack it", async () => {
    const setMailFromDomain = vi.fn(async () => undefined);
    const service = createDomainService({
      repository: createRepository({
        async findById() {
          return domainRow({ status: "pending" });
        },
      }),
      getDomainIdentity: vi.fn(async () => ({
        verified: true,
        mailFromDomain: null,
      })),
      setMailFromDomain,
      invalidateDomainCaches: vi.fn(),
      syncDomainConfigurationSet: vi.fn(async () => "cfg-domain-1"),
    });

    await service.reconcileVerification("domain-1");

    expect(setMailFromDomain).toHaveBeenCalledWith(
      "example.com",
      "send.example.com",
      { region: "us-east-1" },
    );
  });

  it("reconcileVerification skips MAIL FROM when SES already matches the return path", async () => {
    const setMailFromDomain = vi.fn(async () => undefined);
    const service = createDomainService({
      repository: createRepository({
        async findById() {
          return domainRow({ status: "verified" });
        },
      }),
      getDomainIdentity: vi.fn(async () => ({
        verified: true,
        mailFromDomain: "send.example.com",
      })),
      setMailFromDomain,
      invalidateDomainCaches: vi.fn(),
      syncDomainConfigurationSet: vi.fn(async () => "cfg-domain-1"),
    });

    await service.reconcileVerification("domain-1");

    expect(setMailFromDomain).not.toHaveBeenCalled();
  });

  it("createDomain succeeds even when the MAIL FROM call fails (non-fatal)", async () => {
    const service = createDomainService({
      repository: createRepository(),
      createDomainIdentity: vi.fn(async () => ({
        dkimTokens: ["dkim-a"],
        status: "PENDING",
      })),
      setMailFromDomain: vi.fn(async () => {
        throw new Error("ses unavailable");
      }),
      invalidateDomainCaches: vi.fn(),
      syncDomainConfigurationSet: vi.fn(async () => "cfg-created-domain"),
    });

    const result = await service.createDomain({
      name: "example.com",
      userId: "user-1",
    });

    expect(result.name).toBe("example.com");
  });
});
