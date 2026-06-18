import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockAuthorizeDashboardOrApiKey = vi.hoisted(() => vi.fn());
const mockGetServerSession = vi.hoisted(() => vi.fn());
const mockRequireFullAccessForApiKeyCaller = vi.hoisted(() => vi.fn());
const mockReadDashboardAggregateCache = vi.hoisted(() => vi.fn());
const mockWriteDashboardAggregateCache = vi.hoisted(() => vi.fn());
const mockBroadcastService = vi.hoisted(() => ({
  listBroadcasts: vi.fn(),
  createBroadcast: vi.fn(),
  getBroadcast: vi.fn(),
  updateBroadcast: vi.fn(),
  deleteBroadcast: vi.fn(),
  sendBroadcast: vi.fn(),
  getBroadcastMetrics: vi.fn(),
}));
const mockCreateBroadcastService = vi.hoisted(() =>
  vi.fn(() => mockBroadcastService),
);
const MockBroadcastServiceError = vi.hoisted(
  () =>
    class BroadcastServiceError extends Error {
      constructor(
        readonly code:
          | "invalid_input"
          | "not_found"
          | "delete_forbidden"
          | "send_forbidden",
        message: string,
      ) {
        super(message);
        this.name = "BroadcastServiceError";
      }
    },
);
vi.mock("@/lib/api-auth", () => ({
  authorizeDashboardOrApiKey: mockAuthorizeDashboardOrApiKey,
  getServerSession: mockGetServerSession,
  unauthorizedResponse: () =>
    Response.json({ error: "Missing or invalid API key" }, { status: 401 }),
}));

vi.mock("@/lib/api-key-permissions", () => ({
  requireFullAccessForApiKeyCaller: mockRequireFullAccessForApiKeyCaller,
}));

vi.mock("@/lib/cache/dashboard-aggregates", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/cache/dashboard-aggregates")
  >("@/lib/cache/dashboard-aggregates");
  return {
    ...actual,
    readDashboardAggregateCache: mockReadDashboardAggregateCache,
    writeDashboardAggregateCache: mockWriteDashboardAggregateCache,
  };
});

vi.mock("@opensend/core", () => ({
  BroadcastServiceError: MockBroadcastServiceError,
  createBroadcastService: mockCreateBroadcastService,
}));

function makeNextRequest(url: string, init?: RequestInit): NextRequest {
  const request = new Request(url, init) as Request & { nextUrl: URL };
  request.nextUrl = new URL(url);
  return request as unknown as NextRequest;
}

function jsonRequest(url: string, body: Record<string, unknown>): NextRequest {
  return makeNextRequest(url, {
    method: "POST",
    headers: {
      Authorization: "Bearer os_test",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
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
  mockRequireFullAccessForApiKeyCaller.mockReturnValue(null);
  mockReadDashboardAggregateCache.mockResolvedValue(null);
  mockWriteDashboardAggregateCache.mockResolvedValue(undefined);
});

describe("broadcast tenant isolation", () => {
  it("exposes root broadcast aliases as JSON API routes instead of dashboard fallthrough", async () => {
    mockAuthorizeDashboardOrApiKey.mockResolvedValueOnce(null);

    const { middleware } = await import("@/middleware");
    const rewrite = await middleware(
      makeNextRequest("http://localhost:3015/broadcasts", {
        headers: { accept: "application/json" },
      }),
    );
    expect(rewrite.headers.get("x-middleware-rewrite")).toBe(
      "http://localhost:3015/api/broadcasts",
    );

    const apiRoute = await import("@/app/api/broadcasts/route");
    const response = await apiRoute.GET(
      makeNextRequest("http://localhost:3015/api/broadcasts", {
        headers: { accept: "application/json" },
      }),
    );
    expect(response.status).toBe(401);
    expect(response.headers.get("content-type")).toContain("application/json");
    await expect(response.json()).resolves.toEqual({
      error: "Missing or invalid API key",
    });
    expect(mockBroadcastService.listBroadcasts).not.toHaveBeenCalled();
  });

  it("keeps browser navigations to the broadcasts dashboard out of API rewrites", async () => {
    const { middleware } = await import("@/middleware");
    const response = await middleware(
      makeNextRequest("http://localhost:3015/broadcasts", {
        headers: { accept: "text/html" },
      }),
    );

    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
    expect(response.headers.get("location")).toBe("http://localhost:3015/auth");
  });

  it("passes tenant and list filters to the broadcast service", async () => {
    const createdAt = new Date("2026-01-01T00:00:00Z");
    mockBroadcastService.listBroadcasts.mockResolvedValueOnce({
      data: [
        {
          id: "broadcast-1",
          name: "Launch",
          status: "draft",
          audienceId: "segment-1",
          topicId: "topic-1",
          createdAt,
          scheduledAt: null,
        },
      ],
      hasMore: true,
    });

    const { GET } = await import("@/app/api/broadcasts/route");
    const response = await GET(
      makeNextRequest(
        "http://localhost:3015/api/broadcasts?limit=10&search=Launch&status=draft&segmentId=segment-1&after=b0",
      ),
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      object: "list",
      data: [
        {
          id: "broadcast-1",
          name: "Launch",
          status: "draft",
          audience_id: "segment-1",
          topic_id: "topic-1",
          created_at: createdAt.toISOString(),
          scheduled_at: null,
        },
      ],
      has_more: true,
    });
    expect(mockBroadcastService.listBroadcasts).toHaveBeenCalledWith({
      userId: "user-b",
      limit: 10,
      search: "Launch",
      status: "draft",
      segmentId: "segment-1",
      after: "b0",
    });
  });

  it("rejects sending-only API keys before broadcast management", async () => {
    mockAuthorizeDashboardOrApiKey.mockResolvedValueOnce({
      apiKeyId: "key-send",
      permission: "sending_access",
      domain: null,
      userId: "user-b",
    });
    mockRequireFullAccessForApiKeyCaller.mockReturnValueOnce(
      Response.json(
        {
          error:
            "This API key does not have permission to access this resource.",
        },
        { status: 403 },
      ),
    );

    const { POST } = await import("@/app/api/broadcasts/route");
    const response = await POST(
      jsonRequest("http://localhost:3015/api/broadcasts", {
        name: "Launch",
        from: "team@example.com",
        subject: "Hello",
        segment_id: "segment-1",
      }),
    );

    expect(response.status).toBe(403);
    expect(mockBroadcastService.createBroadcast).not.toHaveBeenCalled();
  });

  it("passes created broadcast payloads with the authenticated user id", async () => {
    const createdAt = new Date("2026-01-01T00:00:00Z");
    mockBroadcastService.createBroadcast.mockResolvedValueOnce({
      id: "broadcast-1",
      name: "Launch",
      status: "draft",
      createdAt,
    });

    const body = {
      name: "Launch",
      from: "team@example.com",
      subject: "Hello",
      segment_id: "segment-1",
    };

    const { POST } = await import("@/app/api/broadcasts/route");
    const response = await POST(
      jsonRequest("http://localhost:3015/api/broadcasts", body),
    );
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data).toEqual({
      object: "broadcast",
      id: "broadcast-1",
      name: "Launch",
      status: "draft",
      created_at: createdAt.toISOString(),
    });
    expect(mockBroadcastService.createBroadcast).toHaveBeenCalledWith({
      userId: "user-b",
      body,
    });
  });

  it("delegates root broadcast collection aliases to existing service behavior", async () => {
    const createdAt = new Date("2026-01-01T00:00:00Z");
    const body = {
      name: "Launch",
      from: "team@example.com",
      subject: "Hello",
      segment_id: "segment-1",
    };
    mockBroadcastService.createBroadcast.mockResolvedValueOnce({
      id: "broadcast-1",
      name: "Launch",
      status: "draft",
      createdAt,
    });
    mockBroadcastService.listBroadcasts.mockResolvedValueOnce({
      data: [
        {
          id: "broadcast-1",
          name: "Launch",
          status: "draft",
          audienceId: "segment-1",
          topicId: null,
          createdAt,
          scheduledAt: null,
        },
      ],
      hasMore: false,
    });

    const { middleware } = await import("@/middleware");
    const postRewrite = await middleware(
      jsonRequest("http://localhost:3015/broadcasts", body),
    );
    const getRewrite = await middleware(
      makeNextRequest("http://localhost:3015/broadcasts?limit=5", {
        headers: { Authorization: "Bearer os_test" },
      }),
    );
    expect(postRewrite.headers.get("x-middleware-rewrite")).toBe(
      "http://localhost:3015/api/broadcasts",
    );
    expect(getRewrite.headers.get("x-middleware-rewrite")).toBe(
      "http://localhost:3015/api/broadcasts",
    );

    const apiRoute = await import("@/app/api/broadcasts/route");
    const createResponse = await apiRoute.POST(
      jsonRequest("http://localhost:3015/api/broadcasts", body),
    );
    const listResponse = await apiRoute.GET(
      makeNextRequest("http://localhost:3015/api/broadcasts?limit=5", {
        headers: { Authorization: "Bearer os_test" },
      }),
    );

    expect(createResponse.status).toBe(201);
    expect(listResponse.status).toBe(200);
    expect(mockBroadcastService.createBroadcast).toHaveBeenCalledWith({
      userId: "user-b",
      body,
    });
    expect(mockBroadcastService.listBroadcasts).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-b", limit: 5 }),
    );
  });

  it("returns 404 for broadcast detail reads outside the tenant", async () => {
    mockBroadcastService.getBroadcast.mockRejectedValueOnce(
      new MockBroadcastServiceError("not_found", "Broadcast not found"),
    );

    const { GET } = await import("@/app/api/broadcasts/[id]/route");
    const response = await GET(
      makeNextRequest("http://localhost:3015/api/broadcasts/broadcast-a", {
        headers: { Authorization: "Bearer os_test" },
      }),
      { params: Promise.resolve({ id: "broadcast-a" }) },
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "Broadcast not found",
    });
    expect(mockBroadcastService.getBroadcast).toHaveBeenCalledWith(
      "user-b",
      "broadcast-a",
    );
  });

  it("passes broadcast updates and deletes by id plus user id", async () => {
    mockBroadcastService.updateBroadcast.mockResolvedValueOnce({
      id: "broadcast-1",
      name: "Renamed",
      status: "draft",
      from: null,
      subject: null,
      html: null,
      text: null,
      replyTo: null,
      previewText: null,
      audienceId: null,
      topicId: null,
      scheduledAt: null,
      createdAt: new Date("2026-01-01T00:00:00Z"),
    });
    mockBroadcastService.deleteBroadcast.mockResolvedValueOnce({
      id: "broadcast-1",
    });

    const { PATCH, DELETE } = await import("@/app/api/broadcasts/[id]/route");
    const patchBody = { name: "Renamed" };
    const patchResponse = await PATCH(
      jsonRequest(
        "http://localhost:3015/api/broadcasts/broadcast-1",
        patchBody,
      ),
      { params: Promise.resolve({ id: "broadcast-1" }) },
    );

    expect(patchResponse.status).toBe(200);
    expect(mockBroadcastService.updateBroadcast).toHaveBeenCalledWith({
      id: "broadcast-1",
      userId: "user-b",
      body: patchBody,
    });

    const deleteResponse = await DELETE(
      makeNextRequest("http://localhost:3015/api/broadcasts/broadcast-1", {
        method: "DELETE",
        headers: { Authorization: "Bearer os_test" },
      }),
      { params: Promise.resolve({ id: "broadcast-1" }) },
    );

    expect(deleteResponse.status).toBe(200);
    expect(mockBroadcastService.deleteBroadcast).toHaveBeenCalledWith(
      "user-b",
      "broadcast-1",
    );
  });

  it("delegates root broadcast detail and send aliases with route params", async () => {
    const createdAt = new Date("2026-01-01T00:00:00Z");
    const scheduledAt = new Date("2026-06-01T00:00:00Z");
    mockBroadcastService.getBroadcast.mockResolvedValueOnce({
      id: "broadcast-1",
      name: "Launch",
      status: "draft",
      from: "team@example.com",
      subject: "Hello",
      html: null,
      text: null,
      replyTo: null,
      previewText: null,
      audienceId: "segment-1",
      topicId: null,
      scheduledAt: null,
      createdAt,
    });
    mockBroadcastService.sendBroadcast.mockResolvedValueOnce({
      id: "broadcast-1",
      status: "scheduled",
      scheduledAt,
    });

    const detailRoute = await import("@/app/broadcasts/[id]/route");
    const sendRoute = await import("@/app/broadcasts/[id]/send/route");
    const detailResponse = await detailRoute.GET(
      makeNextRequest("http://localhost:3015/broadcasts/broadcast-1", {
        headers: { Authorization: "Bearer os_test" },
      }),
      { params: Promise.resolve({ id: "broadcast-1" }) },
    );
    const sendBody = { scheduled_at: scheduledAt.toISOString() };
    const sendResponse = await sendRoute.POST(
      jsonRequest(
        "http://localhost:3015/broadcasts/broadcast-1/send",
        sendBody,
      ),
      { params: Promise.resolve({ id: "broadcast-1" }) },
    );

    expect(detailResponse.status).toBe(200);
    expect(sendResponse.status).toBe(200);
    expect(mockBroadcastService.getBroadcast).toHaveBeenCalledWith(
      "user-b",
      "broadcast-1",
    );
    expect(mockBroadcastService.sendBroadcast).toHaveBeenCalledWith({
      userId: "user-b",
      id: "broadcast-1",
      body: sendBody,
    });
  });

  it("passes broadcast send requests through the service with tenant scope", async () => {
    const scheduledAt = new Date("2026-06-01T00:00:00Z");
    const body = { scheduled_at: scheduledAt.toISOString() };
    mockBroadcastService.sendBroadcast.mockResolvedValueOnce({
      id: "broadcast-1",
      status: "scheduled",
      scheduledAt,
    });

    const { POST } = await import("@/app/api/broadcasts/[id]/send/route");
    const response = await POST(
      jsonRequest(
        "http://localhost:3015/api/broadcasts/broadcast-1/send",
        body,
      ),
      { params: Promise.resolve({ id: "broadcast-1" }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      object: "broadcast",
      id: "broadcast-1",
      status: "scheduled",
      scheduled_at: scheduledAt.toISOString(),
    });
    expect(mockBroadcastService.sendBroadcast).toHaveBeenCalledWith({
      userId: "user-b",
      id: "broadcast-1",
      body,
    });
  });

  it("maps broadcast send service errors to preserved HTTP responses", async () => {
    mockBroadcastService.sendBroadcast.mockRejectedValueOnce(
      new MockBroadcastServiceError(
        "send_forbidden",
        "Cannot send a broadcast in queued status",
      ),
    );

    const { POST } = await import("@/app/api/broadcasts/[id]/send/route");
    const forbiddenResponse = await POST(
      jsonRequest("http://localhost:3015/api/broadcasts/broadcast-1/send", {}),
      { params: Promise.resolve({ id: "broadcast-1" }) },
    );

    expect(forbiddenResponse.status).toBe(400);
    await expect(forbiddenResponse.json()).resolves.toEqual({
      error: "Cannot send a broadcast in queued status",
    });

    mockBroadcastService.sendBroadcast.mockRejectedValueOnce(
      new MockBroadcastServiceError(
        "invalid_input",
        "scheduled_at must be a future ISO 8601 date-time",
      ),
    );

    const invalidResponse = await POST(
      jsonRequest("http://localhost:3015/api/broadcasts/broadcast-1/send", {
        scheduled_at: "tomorrow",
      }),
      { params: Promise.resolve({ id: "broadcast-1" }) },
    );

    expect(invalidResponse.status).toBe(422);
    await expect(invalidResponse.json()).resolves.toEqual({
      error: "scheduled_at must be a future ISO 8601 date-time",
    });

    mockBroadcastService.sendBroadcast.mockRejectedValueOnce(
      new MockBroadcastServiceError("not_found", "Broadcast not found"),
    );

    const missingResponse = await POST(
      jsonRequest("http://localhost:3015/api/broadcasts/missing/send", {}),
      { params: Promise.resolve({ id: "missing" }) },
    );

    expect(missingResponse.status).toBe(404);
    await expect(missingResponse.json()).resolves.toEqual({
      error: "Broadcast not found",
    });
  });

  it("passes broadcast metrics requests through the service with cache headers", async () => {
    mockBroadcastService.getBroadcastMetrics.mockResolvedValueOnce({
      cacheStatus: "miss",
      payload: {
        object: "broadcast_metrics",
        broadcast_id: "broadcast-1",
        total: 2,
        delivered: 2,
        bounced: 0,
        complained: 0,
        opened: 1,
        clicked: 1,
        delivery_rate: 100,
        open_rate: 50,
        click_rate: 50,
        bounce_rate: 0,
      },
    });

    const { GET } = await import("@/app/api/broadcasts/[id]/metrics/route");
    const response = await GET(
      makeNextRequest(
        "http://localhost:3015/api/broadcasts/broadcast-1/metrics",
        { headers: { Authorization: "Bearer os_test" } },
      ),
      { params: Promise.resolve({ id: "broadcast-1" }) },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("x-opensend-cache")).toBe("miss");
    expect(mockBroadcastService.getBroadcastMetrics).toHaveBeenCalledWith({
      userId: "user-b",
      id: "broadcast-1",
    });
    expect(mockCreateBroadcastService).toHaveBeenLastCalledWith({
      metricsCache: expect.objectContaining({
        ttlSeconds: 120,
        getKey: expect.any(Function),
        read: mockReadDashboardAggregateCache,
        write: mockWriteDashboardAggregateCache,
      }),
    });
  });
});
