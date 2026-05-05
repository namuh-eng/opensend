import { beforeEach, describe, expect, it, vi } from "vitest";

const mockValidateApiKey = vi.hoisted(() => vi.fn());
const mockListWebhooks = vi.hoisted(() => vi.fn());
const mockCreateWebhook = vi.hoisted(() => vi.fn());
const mockGetWebhook = vi.hoisted(() => vi.fn());
const mockUpdateWebhook = vi.hoisted(() => vi.fn());
const mockDeleteWebhook = vi.hoisted(() => vi.fn());
const mockListApiKeys = vi.hoisted(() => vi.fn());
const mockCreateApiKey = vi.hoisted(() => vi.fn());
const mockGetApiKey = vi.hoisted(() => vi.fn());
const mockDeleteApiKey = vi.hoisted(() => vi.fn());
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

vi.mock("@/lib/api-auth", () => ({
  invalidateApiKeyAuthCache: vi.fn(),
  unauthorizedResponse: () =>
    Response.json({ error: "Missing or invalid API key" }, { status: 401 }),
  validateApiKey: mockValidateApiKey,
}));

vi.mock("@/lib/billing/quota", () => ({
  checkApiKeyQuota: vi.fn().mockResolvedValue({ ok: true }),
  quotaExceededResponse: vi.fn(),
}));

vi.mock("@opensend/core", () => ({
  ApiKeyServiceError: MockApiKeyServiceError,
  createApiKeyService: () => ({
    listApiKeys: mockListApiKeys,
    createApiKey: mockCreateApiKey,
    getApiKey: mockGetApiKey,
    deleteApiKey: mockDeleteApiKey,
  }),
  createWebhookService: () => ({
    listWebhooks: mockListWebhooks,
    createWebhook: mockCreateWebhook,
    getWebhook: mockGetWebhook,
    updateWebhook: mockUpdateWebhook,
    deleteWebhook: mockDeleteWebhook,
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
