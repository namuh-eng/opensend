import { beforeEach, describe, expect, it, vi } from "vitest";

const mockValidateApiKey = vi.hoisted(() => vi.fn());
const mockReserveEmailQuota = vi.hoisted(() => vi.fn());
const mockCheckDomainQuota = vi.hoisted(() => vi.fn());
const mockCheckApiKeyQuota = vi.hoisted(() => vi.fn());
const mockCreateDomainIdentity = vi.hoisted(() => vi.fn());
const mockCreateApiKeyService = vi.hoisted(() => vi.fn());
const mockCreateApiKey = vi.hoisted(() => vi.fn());
const mockDb = vi.hoisted(() => ({
  insert: vi.fn(),
  select: vi.fn(),
  transaction: vi.fn(async (callback: (tx: typeof mockDb) => unknown) =>
    callback(mockDb),
  ),
}));

vi.mock("@/lib/db", () => ({ db: mockDb }));
vi.mock("@/lib/api-auth", () => ({
  authorizeDashboardOrApiKey: mockValidateApiKey,
  getServerSession: vi.fn(),
  validateApiKey: mockValidateApiKey,
  invalidateApiKeyAuthCache: vi.fn(),
  getApiKeyAuthHeaderError: () => null,
  unauthorizedResponse: () =>
    Response.json({ error: "Missing or invalid API key" }, { status: 401 }),
}));
vi.mock("@/lib/billing/quota", () => ({
  reserveEmailQuota: mockReserveEmailQuota,
  checkDomainQuota: mockCheckDomainQuota,
  checkApiKeyQuota: mockCheckApiKeyQuota,
  releaseEmailQuota: vi.fn(),
  quotaExceededResponse: (info: {
    resource: string;
    limit: number;
    used: number;
    plan: string;
    upgrade_url: string;
  }) =>
    Response.json(
      {
        name: "quota_exceeded",
        code: "quota_exceeded",
        message: "Quota exceeded.",
        statusCode: 402,
        details: info,
      },
      { status: 402 },
    ),
}));
vi.mock("@/lib/audit-events", () => ({
  auditContextForApiKey: (input: { userId: string; apiKeyId: string }) => ({
    userId: input.userId,
    actor: { type: "api_key", id: input.apiKeyId },
    source: "api_key",
    sourceApiKeyId: input.apiKeyId,
  }),
  auditContextForDashboardSession: (session: {
    user?: { id?: string; email?: string };
  }) =>
    session.user?.id
      ? {
          userId: session.user.id,
          actor: {
            type: "user",
            id: session.user.id,
            email: session.user.email ?? null,
          },
          source: "dashboard",
          sourceApiKeyId: null,
        }
      : null,
  recordAuditEvent: vi.fn(),
}));
vi.mock("@/lib/events", () => ({
  queueEvent: vi
    .fn()
    .mockResolvedValue({ eventId: "event-1", deliveryIds: [] }),
}));
vi.mock("@/lib/ses", () => ({
  createDomainIdentity: mockCreateDomainIdentity,
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
vi.mock("@/lib/domain-cache", () => ({
  invalidateDomainCaches: vi.fn(),
}));
vi.mock("@opensend/core", async () => {
  const actual =
    await vi.importActual<typeof import("@opensend/core")>("@opensend/core");
  return {
    ...actual,
    ApiKeyServiceError: class ApiKeyServiceError extends Error {
      constructor(
        readonly code: string,
        message: string,
      ) {
        super(message);
        this.name = "ApiKeyServiceError";
      }
    },
    createApiKeyService: mockCreateApiKeyService,
    createDomainService: () => ({
      createDomain: async (input: { name: string; region?: string }) => ({
        id: "domain-1",
        name: input.name,
        status: "pending",
        region: input.region ?? "us-east-1",
        records: [],
        capabilities: [],
        createdAt: new Date("2026-05-15T00:00:00.000Z"),
        customReturnPath: null,
        trackOpens: false,
        trackClicks: false,
        trackingSubdomain: null,
        tls: "optional",
      }),
    }),
    createTelemetryContext: () => ({
      correlationId: "corr-quota",
      traceparent: "00-11111111111111111111111111111111-2222222222222222-01",
    }),
    emitCloudWatchMetric: vi.fn(),
    logTelemetry: vi.fn(),
    recordTelemetryError: vi.fn(),
  };
});

const auth = {
  apiKeyId: "key-1",
  userId: "user-1",
  permission: "full_access",
  domainId: null,
};
const quotaInfo = {
  resource: "emails",
  limit: 0,
  used: 0,
  plan: "no_subscription",
  upgrade_url: "/dashboard/billing",
};

function jsonRequest(url: string, body: unknown): Request {
  return new Request(url, {
    method: "POST",
    headers: {
      Authorization: "Bearer os_test",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

function isLogInsertCall(call: unknown[]): boolean {
  const table = call[0];
  return typeof table === "object" && table !== null && "requestBody" in table;
}

function nonLogInsertCalls(): unknown[][] {
  return mockDb.insert.mock.calls.filter((call) => !isLogInsertCall(call));
}

describe("quota route gates", () => {
  beforeEach(() => {
    vi.resetModules();
    mockValidateApiKey.mockResolvedValue(auth);
    mockReserveEmailQuota.mockReset();
    mockCheckDomainQuota.mockReset();
    mockCheckApiKeyQuota.mockReset();
    mockCreateDomainIdentity.mockReset();
    mockDb.insert.mockReset();
    mockDb.insert.mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    });
    mockDb.select.mockReset();
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    });
    mockDb.transaction.mockImplementation(
      async (callback: (tx: typeof mockDb) => unknown) => callback(mockDb),
    );
    mockCreateApiKey.mockReset();
    mockCreateApiKey.mockResolvedValue({
      id: "created-key",
      token: "os_created",
      tokenHash: "hash-created",
    });
    mockCreateApiKeyService.mockReset();
    mockCreateApiKeyService.mockReturnValue({
      createApiKey: mockCreateApiKey,
    });
  });

  it("returns 402 from POST /api/emails when hosted billing has no active subscription", async () => {
    mockReserveEmailQuota.mockResolvedValue({ ok: false, info: quotaInfo });
    const { POST } = await import("@/app/api/emails/route");

    const res = await POST(
      jsonRequest("http://localhost:3015/api/emails", {
        from: "sender@example.com",
        to: ["user@example.com"],
        subject: "Quota",
        html: "<p>Quota</p>",
      }),
    );

    expect(res.status).toBe(402);
    await expect(res.json()).resolves.toMatchObject({
      name: "quota_exceeded",
      code: "quota_exceeded",
      message: "Quota exceeded.",
      statusCode: 402,
      details: {
        limit: 0,
        used: 0,
        plan: "no_subscription",
        upgrade_url: "/dashboard/billing",
      },
    });
    expect(mockReserveEmailQuota).toHaveBeenCalledWith(
      "user-1",
      1,
      expect.any(Date),
      process.env,
      mockDb,
    );
    expect(nonLogInsertCalls()).toHaveLength(0);
  });

  it("returns 402 from POST /api/emails/batch when hosted billing has no active subscription", async () => {
    mockReserveEmailQuota.mockResolvedValue({ ok: false, info: quotaInfo });
    const { POST } = await import("@/app/api/emails/batch/route");

    const res = await POST(
      jsonRequest("http://localhost:3015/api/emails/batch", [
        {
          from: "sender@example.com",
          to: ["one@example.com"],
          subject: "One",
          html: "<p>One</p>",
        },
        {
          from: "sender@example.com",
          to: ["two@example.com"],
          subject: "Two",
          html: "<p>Two</p>",
        },
      ]),
    );

    expect(res.status).toBe(402);
    expect(mockReserveEmailQuota).toHaveBeenCalledWith(
      "user-1",
      2,
      expect.any(Date),
      process.env,
      mockDb,
    );
    expect(nonLogInsertCalls()).toHaveLength(0);
  });

  it("returns 402 from POST /api/domains when hosted billing has no active subscription", async () => {
    mockCheckDomainQuota.mockResolvedValue({
      ok: false,
      info: { ...quotaInfo, resource: "domains" },
    });
    const { POST } = await import("@/app/api/domains/route");

    const res = await POST(
      jsonRequest("http://localhost:3015/api/domains", {
        name: "example.com",
        region: "us-east-1",
      }),
    );

    expect(res.status).toBe(402);
    expect(mockCheckDomainQuota).toHaveBeenCalledWith("user-1");
    expect(mockCreateDomainIdentity).not.toHaveBeenCalled();
    expect(nonLogInsertCalls()).toHaveLength(0);
  });

  it("returns 402 from POST /api/api-keys when hosted billing has no active subscription", async () => {
    mockCheckApiKeyQuota.mockResolvedValue({
      ok: false,
      info: { ...quotaInfo, resource: "api_keys" },
    });
    const { POST } = await import("@/app/api/api-keys/route");

    const res = await POST(
      jsonRequest("http://localhost:3015/api/api-keys", { name: "extra" }),
    );

    expect(res.status).toBe(402);
    expect(mockCheckApiKeyQuota).toHaveBeenCalledWith("user-1");
    expect(nonLogInsertCalls()).toHaveLength(0);
  });

  it("returns 2xx from POST /api/emails when quota is self-host bypassed", async () => {
    mockReserveEmailQuota.mockResolvedValue({ ok: true, bypassed: true });
    const values = vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([{ id: "email-1" }]),
    });
    mockDb.insert.mockReturnValue({ values });
    const { POST } = await import("@/app/api/emails/route");

    const res = await POST(
      jsonRequest("http://localhost:3015/api/emails", {
        from: "sender@example.com",
        to: ["user@example.com"],
        subject: "Allowed",
        html: "<p>Allowed</p>",
      }),
    );

    expect(res.status).toBeGreaterThanOrEqual(200);
    expect(res.status).toBeLessThan(300);
    expect(mockReserveEmailQuota).toHaveBeenCalledWith(
      "user-1",
      1,
      expect.any(Date),
      process.env,
      mockDb,
    );
    expect(nonLogInsertCalls()).toHaveLength(1);
  });

  it("returns 2xx from POST /api/emails when quota is active paid", async () => {
    mockReserveEmailQuota.mockResolvedValue({ ok: true, bypassed: false });
    const values = vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([{ id: "email-1" }]),
    });
    mockDb.insert.mockReturnValue({ values });
    const { POST } = await import("@/app/api/emails/route");

    const res = await POST(
      jsonRequest("http://localhost:3015/api/emails", {
        from: "sender@example.com",
        to: ["user@example.com"],
        subject: "Allowed",
        html: "<p>Allowed</p>",
      }),
    );

    expect(res.status).toBeGreaterThanOrEqual(200);
    expect(res.status).toBeLessThan(300);
    expect(nonLogInsertCalls()).toHaveLength(1);
  });

  it("returns 2xx from POST /api/domains when quota is self-host or active paid", async () => {
    const { POST } = await import("@/app/api/domains/route");

    mockCheckDomainQuota.mockResolvedValueOnce({ ok: true, bypassed: true });
    const selfHost = await POST(
      jsonRequest("http://localhost:3015/api/domains", {
        name: "selfhost.example.com",
        region: "us-east-1",
      }),
    );
    expect(selfHost.status).toBeGreaterThanOrEqual(200);
    expect(selfHost.status).toBeLessThan(300);

    mockCheckDomainQuota.mockResolvedValueOnce({ ok: true, bypassed: false });
    const active = await POST(
      jsonRequest("http://localhost:3015/api/domains", {
        name: "active.example.com",
        region: "us-east-1",
      }),
    );
    expect(active.status).toBeGreaterThanOrEqual(200);
    expect(active.status).toBeLessThan(300);
  });

  it("returns 2xx from POST /api/api-keys when quota is self-host or active paid", async () => {
    const { POST } = await import("@/app/api/api-keys/route");

    mockCheckApiKeyQuota.mockResolvedValueOnce({ ok: true, bypassed: true });
    const selfHost = await POST(
      jsonRequest("http://localhost:3015/api/api-keys", { name: "self-host" }),
    );
    expect(selfHost.status).toBeGreaterThanOrEqual(200);
    expect(selfHost.status).toBeLessThan(300);

    mockCheckApiKeyQuota.mockResolvedValueOnce({ ok: true, bypassed: false });
    const active = await POST(
      jsonRequest("http://localhost:3015/api/api-keys", { name: "active" }),
    );
    expect(active.status).toBeGreaterThanOrEqual(200);
    expect(active.status).toBeLessThan(300);
  });
});
