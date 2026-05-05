import { beforeEach, describe, expect, it, vi } from "vitest";

const mockAuthorizeDashboardOrApiKey = vi.hoisted(() => vi.fn());
const mockGetServerSession = vi.hoisted(() => vi.fn());
const mockReadDashboardAggregateCache = vi.hoisted(() => vi.fn());
const mockWriteDashboardAggregateCache = vi.hoisted(() => vi.fn());
const mockSelect = vi.hoisted(() => vi.fn());

function makeChain<T>(rows: T[]) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    // biome-ignore lint/suspicious/noThenProperty: mocks Drizzle's thenable query builder
    then: (resolve: (value: T[]) => unknown) => Promise.resolve(resolve(rows)),
  };

  return chain;
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

vi.mock("@/lib/cache/dashboard-aggregates", () => ({
  BROADCAST_METRICS_CACHE_TTL_SECONDS: 120,
  getBroadcastMetricsCacheKey: (params: {
    userId: string;
    broadcastId: string;
  }) =>
    `dashboard-aggregate:v1:broadcast-metrics:${params.userId}:${params.broadcastId}`,
  readDashboardAggregateCache: mockReadDashboardAggregateCache,
  writeDashboardAggregateCache: mockWriteDashboardAggregateCache,
}));

vi.mock("@/lib/db", () => ({
  db: {
    select: mockSelect,
  },
}));

function makeNextRequest(url: string, init?: RequestInit) {
  const request = new Request(url, init) as Request & { nextUrl: URL };
  request.nextUrl = new URL(url);
  return request;
}

describe("broadcast metrics route cache", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockAuthorizeDashboardOrApiKey.mockResolvedValue({
      apiKeyId: "k1",
      userId: "user-1",
    });
    mockGetServerSession.mockResolvedValue(null);
    mockReadDashboardAggregateCache.mockResolvedValue(null);
    mockWriteDashboardAggregateCache.mockResolvedValue(undefined);
  });

  it("returns cached broadcast aggregates after verifying broadcast ownership", async () => {
    mockSelect.mockReturnValueOnce(makeChain([{ id: "b1" }]));
    mockReadDashboardAggregateCache.mockResolvedValue({
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
    expect(mockSelect).toHaveBeenCalledOnce();
    expect(mockWriteDashboardAggregateCache).not.toHaveBeenCalled();
  });

  it("caches fresh broadcast aggregates with a short ttl", async () => {
    mockSelect
      .mockReturnValueOnce(makeChain([{ id: "b1" }]))
      .mockReturnValueOnce(
        makeChain([
          {
            total: 100,
            delivered: 95,
            bounced: 2,
            complained: 0,
            opened: 40,
            clicked: 10,
          },
        ]),
      );

    const route = await import("@/app/api/broadcasts/[id]/metrics/route");
    const response = await route.GET(
      makeNextRequest("http://localhost/api/broadcasts/b1/metrics", {
        headers: { authorization: "Bearer token" },
      }) as never,
      { params: Promise.resolve({ id: "b1" }) },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("x-opensend-cache")).toBe("miss");
    expect(mockWriteDashboardAggregateCache).toHaveBeenCalledOnce();
    expect(mockWriteDashboardAggregateCache).toHaveBeenCalledWith(
      "dashboard-aggregate:v1:broadcast-metrics:user-1:b1",
      expect.objectContaining({
        object: "broadcast_metrics",
        broadcast_id: "b1",
        total: 100,
      }),
      120,
    );
  });
});
