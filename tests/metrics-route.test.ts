import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockGetServerSession = vi.hoisted(() => vi.fn());
const mockReadDashboardAggregateCache = vi.hoisted(() => vi.fn());
const mockWriteDashboardAggregateCache = vi.hoisted(() => vi.fn());
const mockGetMetrics = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-auth", () => ({
  getServerSession: mockGetServerSession,
  unauthorizedResponse: () =>
    new Response(JSON.stringify({ error: "Missing or invalid API key" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    }),
}));

vi.mock("@/lib/cache/dashboard-aggregates", () => ({
  DASHBOARD_METRICS_CACHE_TTL_SECONDS: 60,
  getMetricsAggregateCacheKey: ({
    userId,
    range,
    domain,
    eventType,
  }: {
    userId: string;
    range: string;
    domain: string | null;
    eventType: string | null;
  }) =>
    `dashboard-aggregate:v1:metrics:${userId}:${range}:${domain ?? "all"}:${eventType ?? "all"}`,
  readDashboardAggregateCache: mockReadDashboardAggregateCache,
  writeDashboardAggregateCache: mockWriteDashboardAggregateCache,
}));

vi.mock("@opensend/core", () => ({
  createDashboardAggregateService: () => ({
    getMetrics: mockGetMetrics,
  }),
}));

function makeNextRequest(url: string, init?: RequestInit) {
  const request = new Request(url, init) as Request & { nextUrl: URL };
  request.nextUrl = new URL(url);
  return request;
}

function expectLocalDateParts(
  date: Date,
  expected: {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
    millisecond: number;
  },
) {
  expect(date.getFullYear()).toBe(expected.year);
  expect(date.getMonth()).toBe(expected.month);
  expect(date.getDate()).toBe(expected.day);
  expect(date.getHours()).toBe(expected.hour);
  expect(date.getMinutes()).toBe(expected.minute);
  expect(date.getSeconds()).toBe(expected.second);
  expect(date.getMilliseconds()).toBe(expected.millisecond);
}

function requireDate(value: unknown): Date {
  expect(value).toBeInstanceOf(Date);
  return value as Date;
}

const freshPayload = {
  totalEmails: 10,
  deliverabilityRate: 70,
  bounceRate: 20,
  complainRate: 10,
  complained: 1,
  domains: ["example.com"],
  dailyData: [{ date: "2026-04-23", count: 7 }],
  domainBreakdown: [{ domain: "example.com", count: 10, rate: 70 }],
  bounceBreakdown: {
    permanent: 1,
    transient: 1,
    undetermined: 0,
  },
  dailyBounceData: [{ date: "2026-04-23", rate: 20 }],
  dailyComplainData: [{ date: "2026-04-23", rate: 10 }],
  lastUpdated: "2026-04-23T06:45:30.000Z",
};

describe("metrics route adapter", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 3, 23, 15, 45, 30));
    mockGetServerSession.mockResolvedValue({
      session: { id: "session-1" },
      user: { id: "user-1" },
    });
    mockReadDashboardAggregateCache.mockResolvedValue(null);
    mockWriteDashboardAggregateCache.mockResolvedValue(undefined);
    mockGetMetrics.mockResolvedValue(freshPayload);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns cached metrics payloads without calling the service", async () => {
    mockReadDashboardAggregateCache.mockResolvedValue({
      ...freshPayload,
      totalEmails: 99,
    });

    const metricsRoute = await import("@/app/api/metrics/route");
    const response = await metricsRoute.GET(
      makeNextRequest(
        "http://localhost/api/metrics?range=last_7_days&domain=example.com&event_type=delivered",
      ) as never,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("x-opensend-cache")).toBe("hit");
    expect(mockGetMetrics).not.toHaveBeenCalled();
    expect(mockWriteDashboardAggregateCache).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({ totalEmails: 99 });
    expect(mockReadDashboardAggregateCache).toHaveBeenCalledWith(
      "dashboard-aggregate:v1:metrics:user-1:last_7_days:example.com:delivered",
    );
  });

  it("passes user, query filters, and inclusive rolling bounds to the core service", async () => {
    const metricsRoute = await import("@/app/api/metrics/route");
    const response = await metricsRoute.GET(
      makeNextRequest(
        "http://localhost/api/metrics?range=last_7_days&domain=example.com&event_type=opened",
      ) as never,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("x-opensend-cache")).toBe("miss");
    expect(mockGetMetrics).toHaveBeenCalledOnce();
    const input = mockGetMetrics.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(input.userId).toBe("user-1");
    expect(input.domain).toBe("example.com");
    expect(input.eventType).toBe("opened");
    expectLocalDateParts(requireDate(input.start), {
      year: 2026,
      month: 3,
      day: 17,
      hour: 0,
      minute: 0,
      second: 0,
      millisecond: 0,
    });
    expectLocalDateParts(requireDate(input.end), {
      year: 2026,
      month: 3,
      day: 23,
      hour: 23,
      minute: 59,
      second: 59,
      millisecond: 999,
    });
    expect(mockWriteDashboardAggregateCache).toHaveBeenCalledWith(
      "dashboard-aggregate:v1:metrics:user-1:last_7_days:example.com:opened",
      freshPayload,
      60,
    );
    await expect(response.json()).resolves.toEqual(freshPayload);
  });

  it("matches Yesterday exactly instead of leaking into today", async () => {
    const metricsRoute = await import("@/app/api/metrics/route");
    const response = await metricsRoute.GET(
      makeNextRequest("http://localhost/api/metrics?range=yesterday") as never,
    );

    expect(response.status).toBe(200);
    const input = mockGetMetrics.mock.calls[0]?.[0] as Record<string, unknown>;
    expectLocalDateParts(requireDate(input.start), {
      year: 2026,
      month: 3,
      day: 22,
      hour: 0,
      minute: 0,
      second: 0,
      millisecond: 0,
    });
    expectLocalDateParts(requireDate(input.end), {
      year: 2026,
      month: 3,
      day: 22,
      hour: 23,
      minute: 59,
      second: 59,
      millisecond: 999,
    });
  });

  it("keeps dashboard auth and error mapping in the adapter", async () => {
    mockGetServerSession.mockResolvedValueOnce(null);
    const metricsRoute = await import("@/app/api/metrics/route");

    const unauthorized = await metricsRoute.GET(
      makeNextRequest("http://localhost/api/metrics") as never,
    );
    expect(unauthorized.status).toBe(401);

    mockGetServerSession.mockResolvedValueOnce({
      session: { id: "session-1" },
      user: { id: "user-1" },
    });
    mockGetMetrics.mockRejectedValueOnce(new Error("db down"));
    const failed = await metricsRoute.GET(
      makeNextRequest("http://localhost/api/metrics") as never,
    );
    expect(failed.status).toBe(500);
    await expect(failed.json()).resolves.toEqual({
      error: "Failed to fetch metrics data",
    });
  });
});
