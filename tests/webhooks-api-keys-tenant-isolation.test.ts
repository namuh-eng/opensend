import { beforeEach, describe, expect, it, vi } from "vitest";

const mockValidateApiKey = vi.hoisted(() => vi.fn());
const mockListWebhooks = vi.hoisted(() => vi.fn());
const mockCreateWebhook = vi.hoisted(() => vi.fn());
const mockGetWebhook = vi.hoisted(() => vi.fn());
const mockUpdateWebhook = vi.hoisted(() => vi.fn());
const mockDeleteWebhook = vi.hoisted(() => vi.fn());
const mockReplayWebhookDelivery = vi.hoisted(() => vi.fn());
const mockListSuppressions = vi.hoisted(() => vi.fn());
const mockDeleteSuppression = vi.hoisted(() => vi.fn());
const mockListApiKeys = vi.hoisted(() => vi.fn());
const mockCreateApiKey = vi.hoisted(() => vi.fn());
const mockGetApiKey = vi.hoisted(() => vi.fn());
const mockDeleteApiKey = vi.hoisted(() => vi.fn());
const mockGetServerSession = vi.hoisted(() => vi.fn());
const MockApiKeyServiceError = vi.hoisted(
  () =>
    class ApiKeyServiceError extends Error {
      constructor(
        readonly code: string,
        message: string,
      ) {
        super(message);
        this.name = "ApiKeyServiceError";
      }
    },
);
const MockSuppressionServiceError = vi.hoisted(
  () =>
    class SuppressionServiceError extends Error {
      constructor(
        readonly code: string,
        message: string,
      ) {
        super(message);
        this.name = "SuppressionServiceError";
      }
    },
);
const MockWebhookServiceError = vi.hoisted(
  () =>
    class WebhookServiceError extends Error {
      constructor(
        readonly code: string,
        message: string,
      ) {
        super(message);
        this.name = "WebhookServiceError";
      }
    },
);

vi.mock("@/lib/api-auth", () => ({
  invalidateApiKeyAuthCache: vi.fn(),
  unauthorizedResponse: () =>
    Response.json({ error: "Missing or invalid API key" }, { status: 401 }),
  validateApiKey: mockValidateApiKey,
  authorizeDashboardOrApiKey: mockValidateApiKey,
  getServerSession: mockGetServerSession,
}));

vi.mock("@/lib/billing/quota", () => ({
  checkApiKeyQuota: vi.fn().mockResolvedValue({ ok: true }),
  quotaExceededResponse: vi.fn(),
}));

vi.mock("@opensend/core", () => ({
  ApiKeyServiceError: MockApiKeyServiceError,
  WebhookServiceError: MockWebhookServiceError,
  SuppressionServiceError: MockSuppressionServiceError,
  createApiKeyService: () => ({
    listApiKeys: mockListApiKeys,
    createApiKey: mockCreateApiKey,
    getApiKey: mockGetApiKey,
    deleteApiKey: mockDeleteApiKey,
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
  toApiKeyListResponse: (result: {
    data: Array<{
      id: string;
      name: string;
      createdAt: Date | string;
      lastUsedAt: Date | string | null;
      permission: string;
      domain: string | null;
    }>;
    hasMore: boolean;
  }) => ({
    object: "list",
    data: result.data.map((key) => ({
      id: key.id,
      name: key.name,
      created_at: key.createdAt,
      last_used_at: key.lastUsedAt,
      permission: key.permission,
      domain: key.domain,
    })),
    has_more: result.hasMore,
  }),
  createSuppressionService: () => ({
    listSuppressions: mockListSuppressions,
    deleteSuppression: mockDeleteSuppression,
  }),
  createWebhookService: () => ({
    listWebhooks: mockListWebhooks,
    createWebhook: mockCreateWebhook,
    getWebhook: mockGetWebhook,
    updateWebhook: mockUpdateWebhook,
    deleteWebhook: mockDeleteWebhook,
    replayWebhookDelivery: mockReplayWebhookDelivery,
  }),
}));

function request(url: string, init?: RequestInit) {
  return new Request(url, {
    ...init,
    headers: { authorization: "Bearer user-b-key", ...init?.headers },
  });
}

function notFound(message: string) {
  return new MockApiKeyServiceError("not_found", message);
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  mockValidateApiKey.mockResolvedValue({
    apiKeyId: "key-b",
    permission: "full_access",
    domain: null,
    userId: "user-b",
  });
  mockGetServerSession.mockResolvedValue({
    user: { id: "dashboard-user-b" },
  });
});

describe("webhook API tenant isolation", () => {
  it("returns an empty webhook list scoped to the caller", async () => {
    mockListWebhooks.mockResolvedValue({ data: [], hasMore: false });

    const route = await import("@/app/api/webhooks/route");
    const response = await route.GET(
      request("http://localhost/api/webhooks?limit=50&after=wh-a"),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      object: "list",
      data: [],
      has_more: false,
    });
    expect(mockListWebhooks).toHaveBeenCalledWith({
      userId: "user-b",
      limit: 50,
      after: "wh-a",
    });
  });

  it("stamps created webhooks with the caller user", async () => {
    mockCreateWebhook.mockResolvedValue({
      id: "wh-b",
      endpoint: "https://example.com/b",
      events: ["email.delivered"],
      status: "enabled",
      signingSecret: "whsec_b",
      createdAt: "2026-05-05T00:00:00.000Z",
    });

    const route = await import("@/app/api/webhooks/route");
    const response = await route.POST(
      request("http://localhost/api/webhooks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          endpoint: "https://example.com/b",
          events: ["email.delivered"],
        }),
      }),
    );

    expect(response.status).toBe(201);
    expect(mockCreateWebhook).toHaveBeenCalledWith({
      userId: "user-b",
      endpoint: "https://example.com/b",
      events: ["email.delivered"],
    });
  });

  it("lets a signed-in dashboard user create an owned webhook", async () => {
    mockValidateApiKey.mockResolvedValueOnce({ dashboard: true });
    mockGetServerSession.mockResolvedValueOnce({
      user: { id: "dashboard-user-b", email: "dashboard@example.com" },
    });
    mockCreateWebhook.mockResolvedValue({
      id: "wh-dashboard",
      endpoint: "https://example.com/dashboard",
      events: ["email.sent"],
      status: "enabled",
      signingSecret: "whsec_dashboard",
      createdAt: "2026-05-12T00:00:00.000Z",
    });

    const route = await import("@/app/api/webhooks/route");
    const response = await route.POST(
      new Request("http://localhost/api/webhooks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          endpoint: "https://example.com/dashboard",
          events: ["email.sent"],
        }),
      }),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      object: "webhook",
      id: "wh-dashboard",
      signing_secret: "whsec_dashboard",
    });
    expect(mockCreateWebhook).toHaveBeenCalledWith({
      userId: "dashboard-user-b",
      endpoint: "https://example.com/dashboard",
      events: ["email.sent"],
    });
  });

  it("returns 404 and cannot mutate user A's webhook as user B", async () => {
    mockGetWebhook.mockResolvedValue(undefined);
    mockUpdateWebhook.mockResolvedValue(undefined);
    mockDeleteWebhook.mockResolvedValue(undefined);

    const route = await import("@/app/api/webhooks/[id]/route");
    const params = { params: Promise.resolve({ id: "wh-user-a" }) };

    const getResponse = await route.GET(
      request("http://localhost/api/webhooks/wh-user-a"),
      params,
    );
    expect(getResponse.status).toBe(404);
    expect(mockGetWebhook).toHaveBeenCalledWith("wh-user-a", "user-b");

    const patchResponse = await route.PATCH(
      request("http://localhost/api/webhooks/wh-user-a", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ active: false }),
      }),
      params,
    );
    expect(patchResponse.status).toBe(404);
    expect(mockUpdateWebhook).toHaveBeenCalledWith(
      "wh-user-a",
      "user-b",
      expect.objectContaining({ active: false }),
    );

    const deleteResponse = await route.DELETE(
      request("http://localhost/api/webhooks/wh-user-a", { method: "DELETE" }),
      params,
    );
    expect(deleteResponse.status).toBe(404);
    expect(mockDeleteWebhook).toHaveBeenCalledWith("wh-user-a", "user-b");
  });

  it("rejects webhook routes when caller user ownership cannot be resolved", async () => {
    mockValidateApiKey.mockResolvedValueOnce({
      apiKeyId: "legacy-key",
      permission: "full_access",
      domain: null,
      userId: null,
    });

    const route = await import("@/app/api/webhooks/route");
    const response = await route.GET(request("http://localhost/api/webhooks"));

    expect(response.status).toBe(401);
    expect(mockListWebhooks).not.toHaveBeenCalled();
  });

  it("lets a signed-in dashboard user replay an owned webhook delivery", async () => {
    mockValidateApiKey.mockResolvedValueOnce({ dashboard: true });
    mockGetServerSession.mockResolvedValueOnce({
      user: { id: "dashboard-user-b" },
    });
    mockReplayWebhookDelivery.mockResolvedValue({
      originalDelivery: {
        id: "delivery-original",
        status: "success",
        attempt: 1,
        statusCode: 200,
        responseBody: "accepted",
        attemptedAt: "2026-05-11T00:00:00.000Z",
        nextRetryAt: null,
        createdAt: "2026-05-11T00:00:00.000Z",
      },
      replayDelivery: {
        id: "delivery-replay",
        status: "success",
        attempt: 1,
        statusCode: 200,
        responseBody: "accepted",
        attemptedAt: "2026-05-11T00:01:00.000Z",
        nextRetryAt: null,
        createdAt: "2026-05-11T00:01:00.000Z",
      },
    });

    const route = await import(
      "@/app/api/webhooks/[id]/deliveries/[deliveryId]/replay/route"
    );
    const response = await route.POST(
      request("http://localhost/api/webhooks/wh-b/deliveries/delivery/replay", {
        method: "POST",
      }),
      {
        params: Promise.resolve({
          id: "wh-b",
          deliveryId: "delivery-original",
        }),
      },
    );

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toMatchObject({
      object: "webhook_delivery_replay",
      original_delivery: { id: "delivery-original", status: "success" },
      replay_delivery: { id: "delivery-replay", status: "success" },
    });
    expect(mockReplayWebhookDelivery).toHaveBeenCalledWith({
      webhookId: "wh-b",
      deliveryId: "delivery-original",
      userId: "dashboard-user-b",
    });
  });

  it("maps disabled webhook replay rejection to a clear conflict response", async () => {
    mockReplayWebhookDelivery.mockRejectedValue(
      new MockWebhookServiceError(
        "disabled",
        "Webhook endpoint is disabled and cannot replay deliveries",
      ),
    );

    const route = await import(
      "@/app/api/webhooks/[id]/deliveries/[deliveryId]/replay/route"
    );
    const response = await route.POST(
      request("http://localhost/api/webhooks/wh-b/deliveries/delivery/replay", {
        method: "POST",
      }),
      {
        params: Promise.resolve({
          id: "wh-b",
          deliveryId: "delivery-original",
        }),
      },
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "Webhook endpoint is disabled and cannot replay deliveries",
    });
  });
});

describe("control-plane webhooks API parity", () => {
  it("exposes API-key-authenticated Hono webhook CRUD through the existing route service path", async () => {
    mockListWebhooks.mockResolvedValue({
      data: [
        {
          id: "wh-b",
          endpoint: "https://example.com/b",
          events: ["email.delivered"],
          status: "enabled",
          createdAt: "2026-05-05T00:00:00.000Z",
        },
      ],
      hasMore: true,
    });
    mockCreateWebhook.mockResolvedValue({
      id: "wh-created",
      endpoint: "https://example.com/created",
      events: ["email.sent"],
      status: "enabled",
      signingSecret: "whsec_created",
      createdAt: "2026-05-05T00:01:00.000Z",
    });
    mockGetWebhook.mockResolvedValue({
      id: "wh-b",
      endpoint: "https://example.com/b",
      events: ["email.delivered"],
      status: "enabled",
      createdAt: "2026-05-05T00:00:00.000Z",
      recentDeliveries: [
        {
          id: "delivery-1",
          status: "pending",
          attempt: 2,
          statusCode: 503,
          responseBody: "unavailable",
          attemptedAt: "2026-05-05T00:02:00.000Z",
          nextRetryAt: "2026-05-05T00:07:00.000Z",
          createdAt: "2026-05-05T00:01:30.000Z",
        },
      ],
    });
    mockUpdateWebhook.mockResolvedValue({
      id: "wh-b",
      endpoint: "https://example.com/updated",
      events: ["email.bounced"],
      status: "disabled",
      createdAt: "2026-05-05T00:00:00.000Z",
    });
    mockDeleteWebhook.mockResolvedValue({ id: "wh-b" });

    const { createApp } = await import("../services/api/src/index");
    const app = createApp();

    const listResponse = await app.request("/webhooks?limit=50&after=wh-a", {
      headers: { authorization: "Bearer user-b-key" },
    });
    expect(listResponse.status).toBe(200);
    await expect(listResponse.json()).resolves.toEqual({
      object: "list",
      data: [
        {
          id: "wh-b",
          endpoint: "https://example.com/b",
          events: ["email.delivered"],
          status: "enabled",
          created_at: "2026-05-05T00:00:00.000Z",
        },
      ],
      has_more: true,
    });
    expect(mockListWebhooks).toHaveBeenCalledWith({
      userId: "user-b",
      limit: 50,
      after: "wh-a",
    });

    const createResponse = await app.request("/webhooks", {
      method: "POST",
      headers: {
        authorization: "Bearer user-b-key",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        endpoint: "https://example.com/created",
        events: ["email.sent"],
      }),
    });
    expect(createResponse.status).toBe(201);
    await expect(createResponse.json()).resolves.toEqual({
      object: "webhook",
      id: "wh-created",
      endpoint: "https://example.com/created",
      events: ["email.sent"],
      status: "enabled",
      signing_secret: "whsec_created",
      created_at: "2026-05-05T00:01:00.000Z",
    });
    expect(mockCreateWebhook).toHaveBeenCalledWith({
      userId: "user-b",
      endpoint: "https://example.com/created",
      events: ["email.sent"],
    });

    const detailResponse = await app.request("/webhooks/wh-b", {
      headers: { authorization: "Bearer user-b-key" },
    });
    expect(detailResponse.status).toBe(200);
    const detailBody = await detailResponse.json();
    expect(detailBody).toEqual({
      object: "webhook",
      id: "wh-b",
      endpoint: "https://example.com/b",
      events: ["email.delivered"],
      status: "enabled",
      created_at: "2026-05-05T00:00:00.000Z",
      recent_deliveries: [
        {
          id: "delivery-1",
          status: "pending",
          attempt: 2,
          status_code: 503,
          response_body: "unavailable",
          attempted_at: "2026-05-05T00:02:00.000Z",
          next_retry_at: "2026-05-05T00:07:00.000Z",
          created_at: "2026-05-05T00:01:30.000Z",
        },
      ],
    });
    expect(detailBody).not.toHaveProperty("signing_secret");
    expect(mockGetWebhook).toHaveBeenCalledWith("wh-b", "user-b");

    const updateResponse = await app.request("/webhooks/wh-b", {
      method: "PATCH",
      headers: {
        authorization: "Bearer user-b-key",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        url: "https://example.com/updated",
        event_types: ["email.bounced"],
        active: false,
      }),
    });
    expect(updateResponse.status).toBe(200);
    const updateBody = await updateResponse.json();
    expect(updateBody).toEqual({
      object: "webhook",
      id: "wh-b",
      endpoint: "https://example.com/updated",
      events: ["email.bounced"],
      status: "disabled",
      created_at: "2026-05-05T00:00:00.000Z",
    });
    expect(updateBody).not.toHaveProperty("signing_secret");
    expect(mockUpdateWebhook).toHaveBeenCalledWith("wh-b", "user-b", {
      endpoint: "https://example.com/updated",
      events: ["email.bounced"],
      status: undefined,
      active: false,
    });

    const deleteResponse = await app.request("/webhooks/wh-b", {
      method: "DELETE",
      headers: { authorization: "Bearer user-b-key" },
    });
    expect(deleteResponse.status).toBe(200);
    await expect(deleteResponse.json()).resolves.toEqual({
      object: "webhook",
      id: "wh-b",
      deleted: true,
    });
    expect(mockDeleteWebhook).toHaveBeenCalledWith("wh-b", "user-b");
  });

  it("preserves Hono webhooks auth and permission failures before service calls", async () => {
    const { createApp } = await import("../services/api/src/index");
    const app = createApp();

    mockValidateApiKey.mockResolvedValueOnce(null);
    const unauthenticated = await app.request("/webhooks", {
      headers: { authorization: "Bearer invalid" },
    });
    expect(unauthenticated.status).toBe(401);
    await expect(unauthenticated.json()).resolves.toEqual({
      error: "Missing or invalid API key",
    });
    expect(mockListWebhooks).not.toHaveBeenCalled();

    mockValidateApiKey.mockResolvedValueOnce({
      apiKeyId: "sending-key",
      permission: "sending_access",
      domain: null,
      userId: "user-b",
    });
    const forbidden = await app.request("/webhooks", {
      method: "POST",
      headers: {
        authorization: "Bearer sending-key",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        endpoint: "https://example.com/b",
        events: ["email.delivered"],
      }),
    });
    expect(forbidden.status).toBe(403);
    await expect(forbidden.json()).resolves.toMatchObject({
      code: "insufficient_api_key_permission",
      statusCode: 403,
    });
    expect(mockCreateWebhook).not.toHaveBeenCalled();
  });
});

describe("API key API tenant isolation", () => {
  it("returns an empty API-key list scoped to the caller", async () => {
    mockListApiKeys.mockResolvedValue({ data: [], hasMore: false });

    const route = await import("@/app/api/api-keys/route");
    const response = await route.GET(
      request("http://localhost/api/api-keys?limit=50&after=key-a"),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      object: "list",
      data: [],
      has_more: false,
    });
    expect(mockListApiKeys).toHaveBeenCalledWith({
      userId: "user-b",
      limit: 50,
      after: "key-a",
    });
  });

  it("returns 404 and cannot delete user A's API key as user B", async () => {
    mockGetApiKey.mockRejectedValue(notFound("API key not found"));
    mockDeleteApiKey.mockRejectedValue(notFound("API key not found"));

    const route = await import("@/app/api/api-keys/[id]/route");
    const params = { params: Promise.resolve({ id: "key-user-a" }) };

    const getResponse = await route.GET(
      request("http://localhost/api/api-keys/key-user-a"),
      params,
    );
    expect(getResponse.status).toBe(404);
    expect(mockGetApiKey).toHaveBeenCalledWith("key-user-a", "user-b");

    const deleteResponse = await route.DELETE(
      request("http://localhost/api/api-keys/key-user-a", { method: "DELETE" }),
      params,
    );
    expect(deleteResponse.status).toBe(404);
    expect(mockDeleteApiKey).toHaveBeenCalledWith("key-user-a", "user-b");
  });

  it("rejects API-key routes when caller user ownership cannot be resolved", async () => {
    mockValidateApiKey.mockResolvedValueOnce({
      apiKeyId: "legacy-key",
      permission: "full_access",
      domain: null,
      userId: null,
    });

    const route = await import("@/app/api/api-keys/route");
    const response = await route.GET(request("http://localhost/api/api-keys"));

    expect(response.status).toBe(401);
    expect(mockListApiKeys).not.toHaveBeenCalled();
  });
});

describe("API key permission enforcement", () => {
  beforeEach(() => {
    mockValidateApiKey.mockResolvedValue({
      apiKeyId: "sending-key",
      permission: "sending_access",
      domain: null,
      userId: "user-b",
    });
  });

  it("rejects sending-access keys from listing API keys", async () => {
    const route = await import("@/app/api/api-keys/route");
    const response = await route.GET(request("http://localhost/api/api-keys"));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      code: "insufficient_api_key_permission",
      statusCode: 403,
    });
    expect(mockListApiKeys).not.toHaveBeenCalled();
  });

  it("rejects sending-access keys from creating webhooks", async () => {
    const route = await import("@/app/api/webhooks/route");
    const response = await route.POST(
      request("http://localhost/api/webhooks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          endpoint: "https://example.com/b",
          events: ["email.delivered"],
        }),
      }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      code: "insufficient_api_key_permission",
      statusCode: 403,
    });
    expect(mockCreateWebhook).not.toHaveBeenCalled();
  });
});
