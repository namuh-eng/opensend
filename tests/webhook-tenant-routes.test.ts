import { beforeEach, describe, expect, it, vi } from "vitest";

const mockAuthorizeDashboardOrApiKey = vi.hoisted(() => vi.fn());
const mockGetServerSession = vi.hoisted(() => vi.fn());
const mockListWebhooks = vi.hoisted(() => vi.fn());
const mockCreateWebhook = vi.hoisted(() => vi.fn());
const mockGetWebhook = vi.hoisted(() => vi.fn());
const mockUpdateWebhook = vi.hoisted(() => vi.fn());
const mockDeleteWebhook = vi.hoisted(() => vi.fn());
const mockCreateWebhookService = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-auth", () => ({
  authorizeDashboardOrApiKey: mockAuthorizeDashboardOrApiKey,
  getServerSession: mockGetServerSession,
  unauthorizedResponse: () =>
    Response.json({ error: "Missing or invalid API key" }, { status: 401 }),
}));

vi.mock("@opensend/core", () => ({
  createWebhookService: mockCreateWebhookService,
}));

function jsonRequest(
  url: string,
  method: string,
  body?: Record<string, unknown>,
): Request {
  return new Request(url, {
    method,
    headers: {
      Authorization: "Bearer re_test",
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  mockAuthorizeDashboardOrApiKey.mockResolvedValue({
    apiKeyId: "key-user-b",
    permission: "full_access",
    domain: null,
    userId: "user-b",
  });
  mockGetServerSession.mockResolvedValue(null);
  mockCreateWebhookService.mockReturnValue({
    listWebhooks: mockListWebhooks,
    createWebhook: mockCreateWebhook,
    getWebhook: mockGetWebhook,
    updateWebhook: mockUpdateWebhook,
    deleteWebhook: mockDeleteWebhook,
  });
});

describe("webhook tenant isolation", () => {
  it("scopes webhook list queries to the authenticated user", async () => {
    mockListWebhooks.mockResolvedValue({ data: [], hasMore: false });

    const { GET } = await import("@/app/api/webhooks/route");
    const response = await GET(
      new Request("http://localhost:3015/api/webhooks", {
        headers: { Authorization: "Bearer re_test" },
      }),
    );

    expect(response.status).toBe(200);
    expect(mockListWebhooks).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-b" }),
    );
  });

  it("stamps created webhooks with the authenticated user id", async () => {
    mockCreateWebhook.mockResolvedValue({
      id: "wh-1",
      endpoint: "https://example.com/hook",
      events: ["email.sent"],
      status: "enabled",
      signingSecret: "whsec_x",
      createdAt: new Date("2026-05-07T00:00:00Z"),
    });

    const { POST } = await import("@/app/api/webhooks/route");
    const response = await POST(
      jsonRequest("http://localhost:3015/api/webhooks", "POST", {
        endpoint: "https://example.com/hook",
        events: ["email.sent"],
      }),
    );

    expect(response.status).toBe(201);
    expect(mockCreateWebhook).toHaveBeenCalledWith({
      endpoint: "https://example.com/hook",
      events: ["email.sent"],
      userId: "user-b",
    });
  });

  it("scopes webhook detail get/update/delete by user id", async () => {
    mockGetWebhook.mockResolvedValue(undefined);
    const { GET, PATCH, DELETE } = await import(
      "@/app/api/webhooks/[id]/route"
    );

    const getResponse = await GET(
      new Request("http://localhost:3015/api/webhooks/wh-1", {
        headers: { Authorization: "Bearer re_test" },
      }),
      { params: Promise.resolve({ id: "wh-1" }) },
    );
    expect(getResponse.status).toBe(404);
    expect(mockGetWebhook).toHaveBeenCalledWith("wh-1", "user-b");

    mockUpdateWebhook.mockResolvedValue({
      id: "wh-1",
      endpoint: "https://example.com/hook",
      events: ["email.sent"],
      status: "disabled",
      createdAt: new Date("2026-05-07T00:00:00Z"),
    });
    const patchResponse = await PATCH(
      jsonRequest("http://localhost:3015/api/webhooks/wh-1", "PATCH", {
        active: false,
      }),
      { params: Promise.resolve({ id: "wh-1" }) },
    );
    expect(patchResponse.status).toBe(200);
    expect(mockUpdateWebhook).toHaveBeenCalledWith(
      "wh-1",
      expect.any(Object),
      "user-b",
    );

    mockDeleteWebhook.mockResolvedValue({ id: "wh-1" });
    const deleteResponse = await DELETE(
      new Request("http://localhost:3015/api/webhooks/wh-1", {
        method: "DELETE",
        headers: { Authorization: "Bearer re_test" },
      }),
      { params: Promise.resolve({ id: "wh-1" }) },
    );
    expect(deleteResponse.status).toBe(200);
    expect(mockDeleteWebhook).toHaveBeenCalledWith("wh-1", "user-b");
  });

  it("rejects requests with no auth", async () => {
    mockAuthorizeDashboardOrApiKey.mockResolvedValueOnce(null);
    const { GET } = await import("@/app/api/webhooks/route");
    const response = await GET(
      new Request("http://localhost:3015/api/webhooks"),
    );
    expect(response.status).toBe(401);
    expect(mockListWebhooks).not.toHaveBeenCalled();
  });

  it("falls back to dashboard session userId", async () => {
    mockAuthorizeDashboardOrApiKey.mockResolvedValueOnce({ dashboard: true });
    mockGetServerSession.mockResolvedValueOnce({
      session: { id: "sess-1" },
      user: { id: "dashboard-user" },
    });
    mockListWebhooks.mockResolvedValue({ data: [], hasMore: false });

    const { GET } = await import("@/app/api/webhooks/route");
    const response = await GET(
      new Request("http://localhost:3015/api/webhooks"),
    );
    expect(response.status).toBe(200);
    expect(mockListWebhooks).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "dashboard-user" }),
    );
  });
});
