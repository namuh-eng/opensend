import { beforeEach, describe, expect, it, vi } from "vitest";

const mockAuthorizeDashboardOrApiKey = vi.hoisted(() => vi.fn());
const mockGetServerSession = vi.hoisted(() => vi.fn());
const mockInvalidateApiKeyAuthCache = vi.hoisted(() => vi.fn());
const mockCheckApiKeyQuota = vi.hoisted(() => vi.fn());
const mockQuotaExceededResponse = vi.hoisted(() => vi.fn());
const mockCreateApiKeyService = vi.hoisted(() => vi.fn());
const mockListApiKeys = vi.hoisted(() => vi.fn());
const mockCreateApiKey = vi.hoisted(() => vi.fn());
const mockGetApiKey = vi.hoisted(() => vi.fn());
const mockUpdateApiKey = vi.hoisted(() => vi.fn());
const mockDeleteApiKey = vi.hoisted(() => vi.fn());
const mockRecordAuditEvent = vi.hoisted(() => vi.fn());

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
  recordAuditEvent: mockRecordAuditEvent,
}));

vi.mock("@/lib/api-auth", () => ({
  authorizeDashboardOrApiKey: mockAuthorizeDashboardOrApiKey,
  getServerSession: mockGetServerSession,
  invalidateApiKeyAuthCache: mockInvalidateApiKeyAuthCache,
  unauthorizedResponse: () =>
    Response.json({ error: "Missing or invalid API key" }, { status: 401 }),
}));

vi.mock("@/lib/billing/quota", () => ({
  checkApiKeyQuota: mockCheckApiKeyQuota,
  quotaExceededResponse: mockQuotaExceededResponse,
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

vi.mock("@opensend/core", async () => {
  const actual =
    await vi.importActual<typeof import("@opensend/core")>("@opensend/core");

  return {
    ...actual,
    createApiKeyService: mockCreateApiKeyService,
  };
});

const createdAt = new Date("2026-05-10T00:00:00.000Z");
const lastUsedAt = new Date("2026-05-10T01:00:00.000Z");

function request(url: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (!headers.has("authorization")) {
    headers.set("authorization", "Bearer os_test");
  }

  return new Request(url, {
    ...init,
    headers,
  });
}

function jsonRequest(url: string, body: unknown) {
  return request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function detailParams(id = "key-1") {
  return { params: Promise.resolve({ id }) };
}

describe("API key route boundary", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    mockAuthorizeDashboardOrApiKey.mockResolvedValue({
      apiKeyId: "caller-key",
      permission: "full_access",
      domain: null,
      userId: "user-1",
    });
    mockGetServerSession.mockResolvedValue(null);
    mockCheckApiKeyQuota.mockResolvedValue({ ok: true });
    mockQuotaExceededResponse.mockImplementation((info: unknown) =>
      Response.json(
        { error: "quota_exceeded", details: info },
        { status: 402 },
      ),
    );
    mockCreateApiKeyService.mockReturnValue({
      listApiKeys: mockListApiKeys,
      createApiKey: mockCreateApiKey,
      getApiKey: mockGetApiKey,
      updateApiKey: mockUpdateApiKey,
      deleteApiKey: mockDeleteApiKey,
    });
  });

  it("lists caller-scoped API keys without exposing token material", async () => {
    mockListApiKeys.mockResolvedValue({
      data: [
        {
          id: "key-1",
          name: "Primary",
          createdAt,
          lastUsedAt,
          permission: "full_access",
          domain: null,
          token: "os_should_not_leak",
          tokenHash: "hash-should-not-leak",
        },
      ],
      hasMore: true,
    });

    const route = await import("@/app/api/api-keys/route");
    const response = await route.GET(
      request("http://localhost/api/api-keys?limit=50&after=key-0"),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      object: "list",
      data: [
        {
          id: "key-1",
          name: "Primary",
          created_at: createdAt.toISOString(),
          last_used_at: lastUsedAt.toISOString(),
          permission: "full_access",
          domain: null,
        },
      ],
      has_more: true,
    });
    expect(mockListApiKeys).toHaveBeenCalledWith({
      userId: "user-1",
      limit: 50,
      after: "key-0",
    });
  });

  it("creates API keys after quota check and returns the token only in the create response", async () => {
    mockCreateApiKey.mockResolvedValue({
      id: "created-key",
      token: "os_created",
      tokenHash: "hash-created",
    });

    const route = await import("@/app/api/api-keys/route");
    const response = await route.POST(
      jsonRequest("http://localhost/api/api-keys", {
        name: "Primary",
        permission: "sending_access",
        domain_id: "domain-1",
      }),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      id: "created-key",
      token: "os_created",
    });
    expect(mockCheckApiKeyQuota).toHaveBeenCalledWith("user-1");
    expect(mockCreateApiKey).toHaveBeenCalledWith({
      name: "Primary",
      permission: "sending_access",
      domainId: "domain-1",
      userId: "user-1",
    });
    expect(mockCreateApiKeyService).toHaveBeenCalledWith({
      invalidateAuthCache: mockInvalidateApiKeyAuthCache,
    });
    expect(mockRecordAuditEvent).toHaveBeenCalledWith({
      context: {
        userId: "user-1",
        actor: { type: "api_key", id: "caller-key" },
        source: "api_key",
        sourceApiKeyId: "caller-key",
      },
      action: "api_key.created",
      targetType: "api_key",
      targetId: "created-key",
      metadata: {
        name: "Primary",
        permission: "sending_access",
        domain_id: "domain-1",
      },
    });
    expect(JSON.stringify(mockRecordAuditEvent.mock.calls)).not.toContain(
      "os_created",
    );
  });

  it("returns API-key detail without token material", async () => {
    mockGetApiKey.mockResolvedValue({
      id: "key-1",
      name: "Primary",
      createdAt,
      lastUsedAt,
      permission: "full_access",
      domain: "domain-1",
      tokenHash: "hash-should-not-leak",
    });

    const route = await import("@/app/api/api-keys/[id]/route");
    const response = await route.GET(
      request("http://localhost/api/api-keys/key-1"),
      detailParams(),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      object: "api_key",
      id: "key-1",
      name: "Primary",
      created_at: createdAt.toISOString(),
      last_used_at: lastUsedAt.toISOString(),
      permission: "full_access",
      domain: "domain-1",
    });
    expect(mockGetApiKey).toHaveBeenCalledWith("key-1", "user-1");
  });

  it("updates caller-owned API keys and records sanitized audit metadata", async () => {
    mockUpdateApiKey.mockResolvedValue({
      id: "key-1",
      name: "Renamed",
      createdAt,
      lastUsedAt,
      permission: "sending_access",
      domain: "domain-1",
    });

    const route = await import("@/app/api/api-keys/[id]/route");
    const response = await route.PATCH(
      request("http://localhost/api/api-keys/key-1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Renamed",
          permission: "sending_access",
          domain_id: "domain-1",
        }),
      }),
      detailParams(),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      object: "api_key",
      id: "key-1",
      name: "Renamed",
      permission: "sending_access",
      domain: "domain-1",
    });
    expect(mockUpdateApiKey).toHaveBeenCalledWith("key-1", "user-1", {
      name: "Renamed",
      permission: "sending_access",
      domainId: "domain-1",
    });
    expect(mockRecordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "api_key.updated",
        targetType: "api_key",
        targetId: "key-1",
        metadata: {
          name: "Renamed",
          permission: "sending_access",
          domain_id: "domain-1",
        },
      }),
    );
  });

  it("deletes caller-owned API keys with an empty 200 response body", async () => {
    mockDeleteApiKey.mockResolvedValue({
      id: "key-1",
      tokenHash: "hash-deleted",
    });

    const route = await import("@/app/api/api-keys/[id]/route");
    const response = await route.DELETE(
      request("http://localhost/api/api-keys/key-1", { method: "DELETE" }),
      detailParams(),
    );

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toBe("");
    expect(mockDeleteApiKey).toHaveBeenCalledWith("key-1", "user-1");
    expect(mockCreateApiKeyService).toHaveBeenCalledWith({
      invalidateAuthCache: mockInvalidateApiKeyAuthCache,
    });
    expect(mockRecordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "api_key.deleted",
        targetType: "api_key",
        targetId: "key-1",
      }),
    );
  });

  it("preserves dashboard-session callers by resolving the session user before the service call", async () => {
    mockAuthorizeDashboardOrApiKey.mockResolvedValue({ dashboard: true });
    mockGetServerSession.mockResolvedValue({
      user: { id: "dashboard-user" },
    });
    mockListApiKeys.mockResolvedValue({ data: [], hasMore: false });

    const route = await import("@/app/api/api-keys/route");
    const response = await route.GET(request("http://localhost/api/api-keys"));

    expect(response.status).toBe(200);
    expect(mockListApiKeys).toHaveBeenCalledWith({
      userId: "dashboard-user",
      limit: 20,
      after: "",
    });
  });

  it("preserves tenant isolation by mapping service not-found misses to 404", async () => {
    const { ApiKeyServiceError } = await import("@opensend/core");
    mockGetApiKey.mockRejectedValue(
      new ApiKeyServiceError("not_found", "API key not found"),
    );
    mockDeleteApiKey.mockRejectedValue(
      new ApiKeyServiceError("not_found", "API key not found"),
    );

    const route = await import("@/app/api/api-keys/[id]/route");
    const getResponse = await route.GET(
      request("http://localhost/api/api-keys/key-other-user"),
      detailParams("key-other-user"),
    );
    const deleteResponse = await route.DELETE(
      request("http://localhost/api/api-keys/key-other-user", {
        method: "DELETE",
      }),
      detailParams("key-other-user"),
    );

    expect(getResponse.status).toBe(404);
    await expect(getResponse.json()).resolves.toEqual({
      error: "API key not found",
    });
    expect(deleteResponse.status).toBe(404);
    await expect(deleteResponse.json()).resolves.toEqual({
      error: "API key not found",
    });
    expect(mockGetApiKey).toHaveBeenCalledWith("key-other-user", "user-1");
    expect(mockDeleteApiKey).toHaveBeenCalledWith("key-other-user", "user-1");
  });

  it("rejects sending-access callers before quota and create service work", async () => {
    mockAuthorizeDashboardOrApiKey.mockResolvedValue({
      apiKeyId: "sending-key",
      permission: "sending_access",
      domain: null,
      userId: "user-1",
    });

    const route = await import("@/app/api/api-keys/route");
    const response = await route.POST(
      jsonRequest("http://localhost/api/api-keys", { name: "Blocked" }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      code: "insufficient_api_key_permission",
      statusCode: 403,
    });
    expect(mockCheckApiKeyQuota).not.toHaveBeenCalled();
    expect(mockCreateApiKey).not.toHaveBeenCalled();
  });

  it("preserves quota failure behavior before create service work", async () => {
    const quotaInfo = {
      resource: "api_keys",
      limit: 2,
      used: 2,
      plan: "free",
      upgrade_url: "/dashboard/billing",
    };
    mockCheckApiKeyQuota.mockResolvedValue({
      ok: false,
      info: quotaInfo,
    });

    const route = await import("@/app/api/api-keys/route");
    const response = await route.POST(
      jsonRequest("http://localhost/api/api-keys", { name: "Blocked" }),
    );

    expect(response.status).toBe(402);
    await expect(response.json()).resolves.toEqual({
      error: "quota_exceeded",
      details: quotaInfo,
    });
    expect(mockQuotaExceededResponse).toHaveBeenCalledWith(quotaInfo);
    expect(mockCreateApiKey).not.toHaveBeenCalled();
  });
});
