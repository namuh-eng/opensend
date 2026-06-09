import { beforeEach, describe, expect, it, vi } from "vitest";

const mockValidateApiKey = vi.hoisted(() => vi.fn());
const mockGetServerSession = vi.hoisted(() => vi.fn());
const mockInvalidateApiKeyAuthCache = vi.hoisted(() => vi.fn());
const mockCreateApiKey = vi.hoisted(() => vi.fn());
const mockDeleteApiKey = vi.hoisted(() => vi.fn());
const mockCreateDomain = vi.hoisted(() => vi.fn());
const mockGetCachedDomainById = vi.hoisted(() => vi.fn());
const mockGetCachedDomainIdentity = vi.hoisted(() => vi.fn());
const mockInvalidateDomainCaches = vi.hoisted(() => vi.fn());
const mockCreateDomainIdentity = vi.hoisted(() => vi.fn());
const mockDeleteDomainIdentity = vi.hoisted(() => vi.fn());
const mockListDNSRecords = vi.hoisted(() => vi.fn());
const mockDeleteDNSRecord = vi.hoisted(() => vi.fn());
const mockQueueEvent = vi.hoisted(() => vi.fn());
const mockReconcileVerification = vi.hoisted(() => vi.fn());
const MockDomainDetailServiceError = vi.hoisted(
  () =>
    class DomainDetailServiceError extends Error {
      constructor(
        readonly code: string,
        message: string,
      ) {
        super(message);
        this.name = "DomainDetailServiceError";
      }
    },
);

const VALID_DOMAIN_ID = "11111111-1111-4111-8111-111111111111";

const mockDb = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}));

vi.mock("@/lib/workspace-route-auth", () => ({
  resolveWorkspaceRouteContext: async (input: {
    auth: { userId?: string | null; apiKeyId?: string } | { dashboard: true };
    session?: {
      user?: { id?: string | null; email?: string | null } | null;
    } | null;
  }) => {
    if ("apiKeyId" in input.auth && !input.auth.userId) {
      return {
        response: Response.json(
          { error: "Missing or invalid API key" },
          { status: 401 },
        ),
      };
    }
    const tenantUserId =
      "apiKeyId" in input.auth
        ? input.auth.userId
        : (input.session?.user?.id ?? "dashboard-user");
    const apiKeyId = "apiKeyId" in input.auth ? input.auth.apiKeyId : null;
    return {
      tenantUserId,
      actorUserId: tenantUserId,
      workspace: {
        workspaceId: "workspace-1",
        workspaceName: "Test Workspace",
        actorUserId: tenantUserId,
        tenantUserId,
        role: "owner",
      },
      auditContext: {
        userId: tenantUserId,
        actor: apiKeyId
          ? { type: "api_key", id: apiKeyId }
          : {
              type: "user",
              id: tenantUserId,
              email: input.session?.user?.email ?? null,
            },
        source: apiKeyId ? "api_key" : "dashboard",
        sourceApiKeyId: apiKeyId,
      },
    };
  },
}));

vi.mock("@opensend/core", () => ({
  DomainDetailServiceError: MockDomainDetailServiceError,
  ApiKeyServiceError: class ApiKeyServiceError extends Error {},
  createApiKeyService: () => ({
    createApiKey: mockCreateApiKey,
    deleteApiKey: mockDeleteApiKey,
    getApiKey: vi.fn(),
    listApiKeys: vi.fn(),
  }),
  parseCreateApiKeyBody: (body: unknown) => {
    const record =
      body && typeof body === "object" ? (body as Record<string, unknown>) : {};
    return {
      name: typeof record.name === "string" ? record.name : "",
      permission:
        record.permission === "full_access" ||
        record.permission === "sending_access"
          ? record.permission
          : undefined,
      domainId:
        typeof record.domain_id === "string" ? record.domain_id : undefined,
    };
  },
  toApiKeyCreateResponse: (created: { id: string; token: string }) => ({
    id: created.id,
    token: created.token,
  }),
  toApiKeyDetailResponse: (key: {
    id: string;
    name: string;
    createdAt: Date | string;
    lastUsedAt: Date | string | null;
    permission: string;
    domain: string | null;
  }) => ({
    object: "api_key",
    id: key.id,
    name: key.name,
    created_at: key.createdAt,
    last_used_at: key.lastUsedAt,
    permission: key.permission,
    domain: key.domain,
  }),
  createDomainService: () => ({
    createDomain: mockCreateDomain,
    reconcileVerification: mockReconcileVerification,
  }),
  createDomainDetailService: () => ({
    updateDomainDetail: async (input: {
      id: string;
      userId: string;
      updates: Record<string, unknown>;
    }) => {
      const existing = await mockGetCachedDomainById(input.id);
      if (!existing || existing.userId !== input.userId) {
        throw new MockDomainDetailServiceError("not_found", "Not found");
      }
      await mockInvalidateDomainCaches({ id: input.id, name: existing.name });
      return {
        response: { object: "domain", id: input.id },
        changedFields: Object.keys(input.updates),
        eventPayload: {
          id: input.id,
          changed_fields: Object.keys(input.updates),
          domain: {
            id: input.id,
            name: existing.name,
            status: existing.status ?? "not_started",
            region: existing.region ?? "us-east-1",
            records: existing.records ?? [],
            capabilities: existing.capabilities ?? [],
            created_at:
              existing.createdAt ?? new Date("2026-05-06T00:00:00.000Z"),
          },
        },
      };
    },
    deleteDomainDetail: async (input: { id: string; userId: string }) => {
      const existing = await mockGetCachedDomainById(input.id);
      if (!existing || existing.userId !== input.userId) {
        throw new MockDomainDetailServiceError("not_found", "Not found");
      }
      await mockInvalidateDomainCaches({ id: input.id, name: existing.name });
      return {
        response: { object: "domain", id: input.id, deleted: true },
        eventPayload: { id: input.id, name: existing.name },
      };
    },
  }),
  DMARC_RECORD_VALUE: "v=DMARC1; p=none;",
  buildDmarcRecordName: (domainName: string) => `_dmarc.${domainName}`,
  getEffectiveReturnPathLabel: (customReturnPath: string | null | undefined) =>
    customReturnPath?.trim() || "send",
}));

vi.mock("@/lib/api-auth", () => ({
  authorizeDashboardOrApiKey: mockValidateApiKey,
  getServerSession: mockGetServerSession,
  invalidateApiKeyAuthCache: mockInvalidateApiKeyAuthCache,
  unauthorizedResponse: () =>
    Response.json({ error: "Missing or invalid API key" }, { status: 401 }),
  validateApiKey: mockValidateApiKey,
}));

vi.mock("@/lib/domain-cache", () => ({
  getCachedDomainById: mockGetCachedDomainById,
  getCachedDomainIdentity: mockGetCachedDomainIdentity,
  invalidateDomainCaches: mockInvalidateDomainCaches,
}));

vi.mock("@/lib/db", () => ({
  db: mockDb,
}));

vi.mock("@/lib/ses", () => ({
  createDomainIdentity: mockCreateDomainIdentity,
  deleteDomainIdentity: mockDeleteDomainIdentity,
}));

vi.mock("@/lib/cloudflare", () => ({
  deleteDNSRecord: mockDeleteDNSRecord,
  listDNSRecords: mockListDNSRecords,
}));

vi.mock("@/lib/events", () => ({
  queueEvent: mockQueueEvent,
}));

vi.mock("drizzle-orm", async () => {
  const actual = await vi.importActual("drizzle-orm");
  return {
    ...actual,
    eq: vi.fn((...args: unknown[]) => ({ op: "eq", args })),
  };
});

describe("cache invalidation routes", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockValidateApiKey.mockResolvedValue({
      apiKeyId: "key-1",
      permission: "full_access",
      domain: null,
      userId: "user-1",
    });
    mockCreateDomain.mockReset();
  });

  it("delegates api-key create through the thin adapter", async () => {
    mockCreateApiKey.mockResolvedValue({
      id: "created-key",
      token: "os_created",
      tokenHash: "hash-123",
    });

    const route = await import("@/app/api/api-keys/route");
    const response = await route.POST(
      new Request("http://localhost/api/api-keys", {
        method: "POST",
        headers: {
          authorization: "Bearer admin",
          "content-type": "application/json",
        },
        body: JSON.stringify({ name: "Primary" }),
      }),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      id: "created-key",
      token: "os_created",
    });
    expect(mockCreateApiKey).toHaveBeenCalledWith({
      name: "Primary",
      permission: undefined,
      domainId: undefined,
      userId: "user-1",
    });
  });

  it("delegates domain create through the thin adapter", async () => {
    mockCreateDomain.mockResolvedValue({
      id: VALID_DOMAIN_ID,
      name: "example.com",
      status: "not_started",
      region: "us-east-1",
      records: [],
      trackOpens: false,
      trackClicks: false,
      trackingSubdomain: null,
      tls: "opportunistic",
      capabilities: [{ name: "sending", enabled: true }],
      createdAt: new Date("2026-04-28T00:00:00.000Z"),
      customReturnPath: null,
    });

    const route = await import("@/app/api/domains/route");
    const response = await route.POST(
      new Request("http://localhost/api/domains", {
        method: "POST",
        headers: {
          authorization: "Bearer key",
          "content-type": "application/json",
        },
        body: JSON.stringify({ name: "Example.COM" }),
      }),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      custom_return_path: null,
      return_path: "send",
    });
    expect(mockCreateDomain).toHaveBeenCalledWith({
      name: "Example.COM",
      region: "us-east-1",
      customReturnPath: undefined,
      openTracking: undefined,
      clickTracking: undefined,
      trackingSubdomain: undefined,
      tls: "opportunistic",
      capabilities: undefined,
      userId: "user-1",
    });
  });

  it("delegates api-key delete through the thin adapter", async () => {
    mockDeleteApiKey.mockResolvedValue({ id: "key-1", tokenHash: "hash-456" });

    const route = await import("@/app/api/api-keys/[id]/route");
    const response = await route.DELETE(new Request("http://localhost"), {
      params: Promise.resolve({ id: "key-1" }),
    });

    expect(response.status).toBe(200);
    expect(mockDeleteApiKey).toHaveBeenCalledWith("key-1", "user-1");
  });

  it("invalidates domain caches after patch", async () => {
    mockGetCachedDomainById.mockResolvedValue({
      id: VALID_DOMAIN_ID,
      name: "example.com",
      userId: "user-1",
      capabilities: [{ name: "sending", enabled: true }],
    });
    mockDb.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([
            {
              id: VALID_DOMAIN_ID,
              name: "example.com",
            },
          ]),
        }),
      }),
    });

    const route = await import("@/app/api/domains/[id]/route");
    const response = await route.PATCH(
      new Request("http://localhost", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ click_tracking: true }),
      }),
      {
        params: Promise.resolve({ id: VALID_DOMAIN_ID }),
      },
    );

    expect(response.status).toBe(200);
    expect(mockInvalidateDomainCaches).toHaveBeenCalledWith({
      id: VALID_DOMAIN_ID,
      name: "example.com",
    });
  });

  it("returns 404 for cross-tenant domain patch", async () => {
    mockGetCachedDomainById.mockResolvedValue({
      id: VALID_DOMAIN_ID,
      name: "example.com",
      userId: "other-user",
      capabilities: [{ name: "sending", enabled: true }],
    });

    const route = await import("@/app/api/domains/[id]/route");
    const response = await route.PATCH(
      new Request("http://localhost", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ click_tracking: true }),
      }),
      {
        params: Promise.resolve({ id: VALID_DOMAIN_ID }),
      },
    );

    expect(response.status).toBe(404);
    expect(mockDb.update).not.toHaveBeenCalled();
    expect(mockInvalidateDomainCaches).not.toHaveBeenCalled();
  });

  it("verify route returns 200 and enqueues domain.updated when reconcile succeeds", async () => {
    // Cache invalidation is now owned by the service (injected via factory).
    // The route no longer calls invalidateDomainCaches directly.
    mockGetCachedDomainById.mockResolvedValue({
      id: VALID_DOMAIN_ID,
      name: "example.com",
      userId: "user-1",
      status: "pending",
      records: [],
    });
    mockReconcileVerification.mockResolvedValue({
      status: "updated",
      domain: {
        id: VALID_DOMAIN_ID,
        name: "example.com",
        status: "verified",
        records: [],
        capabilities: [],
        customReturnPath: null,
        createdAt: new Date("2026-04-28T00:00:00.000Z"),
      },
      previousStatus: "pending",
    });

    const route = await import("@/app/api/domains/[id]/verify/route");
    const response = await route.POST(new Request("http://localhost"), {
      params: Promise.resolve({ id: VALID_DOMAIN_ID }),
    });

    expect(response.status).toBe(200);
    expect(mockQueueEvent).toHaveBeenCalledOnce();
  });

  it("invalidates domain caches after delete", async () => {
    mockGetCachedDomainById.mockResolvedValue({
      id: VALID_DOMAIN_ID,
      name: "example.com",
      userId: "user-1",
    });
    mockListDNSRecords.mockResolvedValue([]);
    mockDb.delete.mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: VALID_DOMAIN_ID }]),
      }),
    });

    const route = await import("@/app/api/domains/[id]/route");
    const response = await route.DELETE(new Request("http://localhost"), {
      params: Promise.resolve({ id: VALID_DOMAIN_ID }),
    });

    expect(response.status).toBe(200);
    expect(mockInvalidateDomainCaches).toHaveBeenCalledWith({
      id: VALID_DOMAIN_ID,
      name: "example.com",
    });
  });
});
