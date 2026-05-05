import { beforeEach, describe, expect, it, vi } from "vitest";

const mockValidateApiKey = vi.hoisted(() => vi.fn());
const mockListApiKeys = vi.hoisted(() => vi.fn());
const mockGetApiKey = vi.hoisted(() => vi.fn());
const mockDeleteApiKey = vi.hoisted(() => vi.fn());
const mockCreateApiKey = vi.hoisted(() => vi.fn());
const mockListWebhooks = vi.hoisted(() => vi.fn());
const mockCreateWebhook = vi.hoisted(() => vi.fn());
const mockGetWebhook = vi.hoisted(() => vi.fn());
const mockUpdateWebhook = vi.hoisted(() => vi.fn());
const mockDeleteWebhook = vi.hoisted(() => vi.fn());
const mockCheckApiKeyQuota = vi.hoisted(() => vi.fn());

class MockApiKeyServiceError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

vi.mock("@/lib/api-auth", () => ({
  invalidateApiKeyAuthCache: vi.fn(),
  unauthorizedResponse: () =>
    Response.json({ error: "Missing or invalid API key" }, { status: 401 }),
  validateApiKey: mockValidateApiKey,
}));

vi.mock("@/lib/billing/quota", () => ({
  checkApiKeyQuota: mockCheckApiKeyQuota,
  quotaExceededResponse: () =>
    Response.json({ error: "quota exceeded" }, { status: 402 }),
}));

vi.mock("@opensend/core", () => ({
  ApiKeyServiceError: MockApiKeyServiceError,
  createApiKeyService: () => ({
    listApiKeys: mockListApiKeys,
    getApiKey: mockGetApiKey,
    deleteApiKey: mockDeleteApiKey,
    createApiKey: mockCreateApiKey,
  }),
  createWebhookService: () => ({
    listWebhooks: mockListWebhooks,
    createWebhook: mockCreateWebhook,
    getWebhook: mockGetWebhook,
    updateWebhook: mockUpdateWebhook,
    deleteWebhook: mockDeleteWebhook,
  }),
}));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  mockValidateApiKey.mockResolvedValue({
    apiKeyId: "key-user-b",
    permission: "full_access",
    domain: null,
    userId: "user-b",
  });
  mockCheckApiKeyQuota.mockResolvedValue({ ok: true });
  mockListApiKeys.mockResolvedValue({ data: [], hasMore: false });
  mockGetApiKey.mockResolvedValue({
    id: "api-key-1",
    name: "Primary",
    createdAt: "2026-05-06T00:00:00.000Z",
    lastUsedAt: null,
  });
  mockDeleteApiKey.mockResolvedValue({ id: "api-key-1", tokenHash: "hash-1" });
  mockCreateApiKey.mockResolvedValue({ id: "api-key-2", token: "re_created" });
  mockListWebhooks.mockResolvedValue({ data: [], hasMore: false });
  mockCreateWebhook.mockResolvedValue({
    id: "webhook-1",
    endpoint: "https://example.com/webhook",
    events: ["email.delivered"],
    status: "enabled",
    signingSecret: "whsec_secret",
    createdAt: "2026-05-06T00:00:00.000Z",
  });
  mockGetWebhook.mockResolvedValue({
    id: "webhook-1",
    endpoint: "https://example.com/webhook",
    events: ["email.delivered"],
    status: "enabled",
    createdAt: "2026-05-06T00:00:00.000Z",
  });
  mockUpdateWebhook.mockResolvedValue({
    id: "webhook-1",
    endpoint: "https://example.com/webhook",
    events: ["email.delivered"],
    status: "disabled",
    createdAt: "2026-05-06T00:00:00.000Z",
  });
  mockDeleteWebhook.mockResolvedValue({ id: "webhook-1" });
});

describe("API key tenant route scoping", () => {
  it("passes authenticated user id to list, create, get, and delete operations", async () => {
    const listRoute = await import("@/app/api/api-keys/route");
    const detailRoute = await import("@/app/api/api-keys/[id]/route");

    await listRoute.GET(
      new Request("http://localhost/api/api-keys?limit=10&after=api-key-0", {
        headers: { Authorization: "Bearer re_test" },
      }),
    );
    await listRoute.POST(
      new Request("http://localhost/api/api-keys", {
        method: "POST",
        headers: {
          Authorization: "Bearer re_test",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: "Primary" }),
      }),
    );
    await detailRoute.GET(
      new Request("http://localhost/api/api-keys/api-key-1", {
        headers: { Authorization: "Bearer re_test" },
      }),
      { params: Promise.resolve({ id: "api-key-1" }) },
    );
    await detailRoute.DELETE(
      new Request("http://localhost/api/api-keys/api-key-1", {
        method: "DELETE",
        headers: { Authorization: "Bearer re_test" },
      }),
      { params: Promise.resolve({ id: "api-key-1" }) },
    );

    expect(mockListApiKeys).toHaveBeenCalledWith({
      limit: 10,
      after: "api-key-0",
      userId: "user-b",
    });
    expect(mockCreateApiKey).toHaveBeenCalledWith({
      name: "Primary",
      permission: undefined,
      domainId: undefined,
      userId: "user-b",
    });
    expect(mockGetApiKey).toHaveBeenCalledWith("api-key-1", {
      userId: "user-b",
    });
    expect(mockDeleteApiKey).toHaveBeenCalledWith("api-key-1", {
      userId: "user-b",
    });
  });

  it("rejects API key management when auth has no user id", async () => {
    mockValidateApiKey.mockResolvedValue({
      apiKeyId: "legacy-key",
      permission: "full_access",
      domain: null,
      userId: null,
    });

    const { GET } = await import("@/app/api/api-keys/route");
    const response = await GET(
      new Request("http://localhost/api/api-keys", {
        headers: { Authorization: "Bearer re_legacy" },
      }),
    );

    expect(response.status).toBe(401);
    expect(mockListApiKeys).not.toHaveBeenCalled();
  });
});

describe("webhook tenant route scoping", () => {
  it("passes authenticated user id to list, create, get, update, and delete operations", async () => {
    const listRoute = await import("@/app/api/webhooks/route");
    const detailRoute = await import("@/app/api/webhooks/[id]/route");

    await listRoute.GET(
      new Request("http://localhost/api/webhooks?limit=10&after=webhook-0", {
        headers: { Authorization: "Bearer re_test" },
      }),
    );
    await listRoute.POST(
      new Request("http://localhost/api/webhooks", {
        method: "POST",
        headers: {
          Authorization: "Bearer re_test",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          endpoint: "https://example.com/webhook",
          events: ["email.delivered"],
        }),
      }),
    );
    await detailRoute.GET(
      new Request("http://localhost/api/webhooks/webhook-1", {
        headers: { Authorization: "Bearer re_test" },
      }),
      { params: Promise.resolve({ id: "webhook-1" }) },
    );
    await detailRoute.PATCH(
      new Request("http://localhost/api/webhooks/webhook-1", {
        method: "PATCH",
        headers: {
          Authorization: "Bearer re_test",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ active: false }),
      }),
      { params: Promise.resolve({ id: "webhook-1" }) },
    );
    await detailRoute.DELETE(
      new Request("http://localhost/api/webhooks/webhook-1", {
        method: "DELETE",
        headers: { Authorization: "Bearer re_test" },
      }),
      { params: Promise.resolve({ id: "webhook-1" }) },
    );

    expect(mockListWebhooks).toHaveBeenCalledWith({
      limit: 10,
      after: "webhook-0",
      userId: "user-b",
    });
    expect(mockCreateWebhook).toHaveBeenCalledWith({
      endpoint: "https://example.com/webhook",
      events: ["email.delivered"],
      userId: "user-b",
    });
    expect(mockGetWebhook).toHaveBeenCalledWith("webhook-1", {
      userId: "user-b",
    });
    expect(mockUpdateWebhook).toHaveBeenCalledWith(
      "webhook-1",
      {
        endpoint: undefined,
        events: undefined,
        status: undefined,
        active: false,
      },
      { userId: "user-b" },
    );
    expect(mockDeleteWebhook).toHaveBeenCalledWith("webhook-1", {
      userId: "user-b",
    });
  });

  it("rejects webhook management when auth has no user id", async () => {
    mockValidateApiKey.mockResolvedValue({
      apiKeyId: "legacy-key",
      permission: "full_access",
      domain: null,
      userId: null,
    });

    const { GET } = await import("@/app/api/webhooks/route");
    const response = await GET(
      new Request("http://localhost/api/webhooks", {
        headers: { Authorization: "Bearer re_legacy" },
      }),
    );

    expect(response.status).toBe(401);
    expect(mockListWebhooks).not.toHaveBeenCalled();
  });
});
