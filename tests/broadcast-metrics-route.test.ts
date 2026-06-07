import { beforeEach, describe, expect, it, vi } from "vitest";

const mockAuthorizeDashboardOrApiKey = vi.hoisted(() => vi.fn());
const mockGetServerSession = vi.hoisted(() => vi.fn());
const mockRequireFullAccessForApiKeyCaller = vi.hoisted(() => vi.fn());
const mockReadDashboardAggregateCache = vi.hoisted(() => vi.fn());
const mockWriteDashboardAggregateCache = vi.hoisted(() => vi.fn());
const mockBroadcastService = vi.hoisted(() => ({
  getBroadcastMetrics: vi.fn(),
}));
const mockCreateBroadcastService = vi.hoisted(() =>
  vi.fn(() => mockBroadcastService),
);

const MockBroadcastServiceError = vi.hoisted(
  () =>
    class BroadcastServiceError extends Error {
      constructor(
        readonly code: "not_found",
        message: string,
      ) {
        super(message);
        this.name = "BroadcastServiceError";
      }
    },
);

function makeNextRequest(url: string, init?: RequestInit) {
  const request = new Request(url, init) as Request & { nextUrl: URL };
  request.nextUrl = new URL(url);
  return request;
}

vi.mock("@/lib/api-auth", () => ({
  unauthorizedResponse: () =>
    new Response(JSON.stringify({ error: "Missing or invalid API key" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    }),
  authorizeDashboardOrApiKey: mockAuthorizeDashboardOrApiKey,
  getServerSession: mockGetServerSession,
}));

vi.mock("@/lib/api-key-permissions", () => ({
  requireFullAccessForApiKeyCaller: mockRequireFullAccessForApiKeyCaller,
}));

vi.mock("@/lib/cache/dashboard-aggregates", () => ({
  BROADCAST_METRICS_CACHE_TTL_SECONDS: 120,
  getBroadcastMetricsCacheKey: (params: {
    userId: string;
    broadcastId: string;
  }) =>
    `dashboard-aggregate:v2:broadcast-metrics:${params.userId}:${params.broadcastId}`,
  readDashboardAggregateCache: mockReadDashboardAggregateCache,
  writeDashboardAggregateCache: mockWriteDashboardAggregateCache,
}));

vi.mock("@opensend/core", () => ({
  BroadcastServiceError: MockBroadcastServiceError,
  createBroadcastService: mockCreateBroadcastService,
}));

describe("broadcast metrics route cache", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockAuthorizeDashboardOrApiKey.mockResolvedValue({
      apiKeyId: "k1",
      permission: "full_access",
      domain: null,
      userId: "user-1",
    });
    mockGetServerSession.mockResolvedValue(null);
    mockRequireFullAccessForApiKeyCaller.mockReturnValue(null);
    mockReadDashboardAggregateCache.mockResolvedValue(null);
    mockWriteDashboardAggregateCache.mockResolvedValue(undefined);
  });

  it("returns cached broadcast aggregates after service ownership verification", async () => {
    mockBroadcastService.getBroadcastMetrics.mockResolvedValue({
      cacheStatus: "hit",
      payload: {
        object: "broadcast_metrics",
        broadcast_id: "b1",
        total: 5,
        delivered: 4,
        bounced: 1,
        complained: 0,
        opened: 3,
        clicked: 1,
        delivery_rate: 80,
        open_rate: 60,
        click_rate: 20,
        bounce_rate: 20,
      },
    });

    const route = await import("@/app/api/broadcasts/[id]/metrics/route");
    const response = await route.GET(
      makeNextRequest("http://localhost/api/broadcasts/b1/metrics", {
        headers: { authorization: "Bearer token" },
      }) as never,
      { params: Promise.resolve({ id: "b1" }) },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("x-opensend-cache")).toBe("hit");
    expect(mockBroadcastService.getBroadcastMetrics).toHaveBeenCalledWith({
      userId: "user-1",
      id: "b1",
    });
    expect(mockCreateBroadcastService).toHaveBeenCalledWith({
      metricsCache: {
        ttlSeconds: 120,
        getKey: expect.any(Function),
        read: mockReadDashboardAggregateCache,
        write: mockWriteDashboardAggregateCache,
      },
    });
  });

  it("returns 404 when the broadcast metrics service reports not found", async () => {
    mockBroadcastService.getBroadcastMetrics.mockRejectedValueOnce(
      new MockBroadcastServiceError("not_found", "Broadcast not found"),
    );

    const route = await import("@/app/api/broadcasts/[id]/metrics/route");
    const response = await route.GET(
      makeNextRequest("http://localhost/api/broadcasts/missing/metrics", {
        headers: { authorization: "Bearer token" },
      }) as never,
      { params: Promise.resolve({ id: "missing" }) },
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "Broadcast not found",
    });
  });

  it("returns fresh broadcast aggregates with miss cache header", async () => {
    mockBroadcastService.getBroadcastMetrics.mockResolvedValue({
      cacheStatus: "miss",
      payload: {
        object: "broadcast_metrics",
        broadcast_id: "b1",
        total: 100,
        delivered: 95,
        bounced: 2,
        complained: 0,
        opened: 40,
        clicked: 10,
        delivery_rate: 95,
        open_rate: 40,
        click_rate: 10,
        bounce_rate: 2,
      },
    });

    const route = await import("@/app/api/broadcasts/[id]/metrics/route");
    const response = await route.GET(
      makeNextRequest("http://localhost/api/broadcasts/b1/metrics", {
        headers: { authorization: "Bearer token" },
      }) as never,
      { params: Promise.resolve({ id: "b1" }) },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("x-opensend-cache")).toBe("miss");
    await expect(response.json()).resolves.toMatchObject({
      object: "broadcast_metrics",
      broadcast_id: "b1",
      total: 100,
    });
  });
});
