import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockSelect = vi.hoisted(() => vi.fn());
const mockGetServerSession = vi.hoisted(() => vi.fn());
const mockReadDashboardAggregateCache = vi.hoisted(() => vi.fn());
const mockWriteDashboardAggregateCache = vi.hoisted(() => vi.fn());
const mockGte = vi.hoisted(() =>
  vi.fn((left, right) => ({ kind: "gte", left, right })),
);
const mockLte = vi.hoisted(() =>
  vi.fn((left, right) => ({ kind: "lte", left, right })),
);
const mockEq = vi.hoisted(() =>
  vi.fn((left, right) => ({ kind: "eq", left, right })),
);
const mockLike = vi.hoisted(() =>
  vi.fn((left, right) => ({ kind: "like", left, right })),
);
const mockAnd = vi.hoisted(() => vi.fn((...conds) => ({ kind: "and", conds })));
const mockInArray = vi.hoisted(() =>
  vi.fn((left, right) => ({ kind: "inArray", left, right })),
);

function makeQueryChain<T>(rows: T[], whereArgs: unknown[]) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn((arg: unknown) => {
      whereArgs.push(arg);
      return chain;
    }),
    groupBy: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    // biome-ignore lint/suspicious/noThenProperty: mocks Drizzle's thenable query builder
    then: (resolve: (value: T[]) => unknown) => Promise.resolve(resolve(rows)),
  };

  return chain;
}

vi.mock("@/lib/db", () => ({
  db: {
    select: mockSelect,
  },
}));

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
    range,
    domain,
    eventType,
  }: {
    range: string;
    domain: string | null;
    eventType: string | null;
  }) =>
    `dashboard-aggregate:v1:metrics:${range}:${domain ?? "all"}:${eventType ?? "all"}`,
  readDashboardAggregateCache: mockReadDashboardAggregateCache,
  writeDashboardAggregateCache: mockWriteDashboardAggregateCache,
}));

vi.mock("drizzle-orm", async () => {
  const actual =
    await vi.importActual<typeof import("drizzle-orm")>("drizzle-orm");

  return {
    ...actual,
    and: mockAnd,
    eq: mockEq,
    gte: mockGte,
    inArray: mockInArray,
    like: mockLike,
    lte: mockLte,
  };
});

function makeNextRequest(url: string, init?: RequestInit) {
  const request = new Request(url, init) as Request & { nextUrl: URL };
  request.nextUrl = new URL(url);
  return request;
}

function queueMetricsQueries(whereArgs: unknown[]) {
  mockSelect
    .mockReturnValueOnce(
      makeQueryChain(
        [
          {
            total: 10,
            delivered: 7,
            bounced: 2,
            hard_bounced: 1,
            soft_bounced: 1,
            undetermined_bounced: 0,
            complained: 1,
          },
        ],
        whereArgs,
      ),
    )
    .mockReturnValueOnce(
      makeQueryChain([{ date: "2026-04-23", count: 7 }], whereArgs),
    )
    .mockReturnValueOnce(
      makeQueryChain(
        [{ date: "2026-04-23", total: 10, bounced: 2 }],
        whereArgs,
      ),
    )
    .mockReturnValueOnce(
      makeQueryChain(
        [{ date: "2026-04-23", total: 10, complained: 1 }],
        whereArgs,
      ),
    )
    .mockReturnValueOnce(
      makeQueryChain(
        [{ domain: "example.com", total: 10, delivered: 7 }],
        whereArgs,
      ),
    );
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

function requireCondition<T>(value: T | undefined): T {
  expect(value).toBeDefined();
  return value as T;
}

describe("metrics route filters", () => {
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
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("matches Yesterday exactly instead of leaking into today", async () => {
    const whereArgs: unknown[] = [];
    queueMetricsQueries(whereArgs);

    const metricsRoute = await import("@/app/api/metrics/route");
    const response = await metricsRoute.GET(
      makeNextRequest("http://localhost/api/metrics?range=yesterday") as never,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("x-opensend-cache")).toBe("miss");

    const firstWhere = whereArgs[0] as {
      kind: string;
      conds: Array<{ kind: string; right: Date }>;
    };

    const lowerBound = firstWhere.conds.find((cond) => cond.kind === "gte");
    const upperBound = firstWhere.conds.find((cond) => cond.kind === "lte");

    expectLocalDateParts(requireCondition(lowerBound).right, {
      year: 2026,
      month: 3,
      day: 22,
      hour: 0,
      minute: 0,
      second: 0,
      millisecond: 0,
    });
    expectLocalDateParts(requireCondition(upperBound).right, {
      year: 2026,
      month: 3,
      day: 22,
      hour: 23,
      minute: 59,
      second: 59,
      millisecond: 999,
    });
  });

  it("uses inclusive rolling preset bounds that match date-range.ts", async () => {
    const whereArgs: unknown[] = [];
    queueMetricsQueries(whereArgs);

    const metricsRoute = await import("@/app/api/metrics/route");
    const response = await metricsRoute.GET(
      makeNextRequest(
        "http://localhost/api/metrics?range=last_7_days",
      ) as never,
    );

    expect(response.status).toBe(200);

    const firstWhere = whereArgs[0] as {
      kind: string;
      conds: Array<{ kind: string; right: Date }>;
    };

    const lowerBound = firstWhere.conds.find((cond) => cond.kind === "gte");
    const upperBound = firstWhere.conds.find((cond) => cond.kind === "lte");

    expectLocalDateParts(requireCondition(lowerBound).right, {
      year: 2026,
      month: 3,
      day: 17,
      hour: 0,
      minute: 0,
      second: 0,
      millisecond: 0,
    });
    expectLocalDateParts(requireCondition(upperBound).right, {
      year: 2026,
      month: 3,
      day: 23,
      hour: 23,
      minute: 59,
      second: 59,
      millisecond: 999,
    });
  });

  it("filters by exact sender domain instead of raw from substring matches", async () => {
    const whereArgs: unknown[] = [];
    queueMetricsQueries(whereArgs);

    const metricsRoute = await import("@/app/api/metrics/route");
    const response = await metricsRoute.GET(
      makeNextRequest(
        "http://localhost/api/metrics?range=last_7_days&domain=example.com",
      ) as never,
    );

    expect(response.status).toBe(200);
    expect(mockEq).toHaveBeenCalledOnce();
    expect(mockEq.mock.calls[0]?.[1]).toBe("example.com");
    expect(mockLike).not.toHaveBeenCalled();

    const firstWhere = whereArgs[0] as {
      kind: string;
      conds: Array<{ kind: string }>;
    };
    expect(firstWhere.conds.some((cond) => cond.kind === "eq")).toBe(true);
  });

  it("returns cached metrics payloads without hitting the database", async () => {
    mockReadDashboardAggregateCache.mockResolvedValue({
      totalEmails: 99,
      deliverabilityRate: 98,
      bounceRate: 1,
      complainRate: 0,
      complained: 0,
      domains: ["example.com"],
      dailyData: [],
      domainBreakdown: [],
      bounceBreakdown: {
        permanent: 0,
        transient: 0,
        undetermined: 0,
      },
      dailyBounceData: [],
      dailyComplainData: [],
      lastUpdated: "2026-04-23T06:45:30.000Z",
    });

    const metricsRoute = await import("@/app/api/metrics/route");
    const response = await metricsRoute.GET(
      makeNextRequest(
        "http://localhost/api/metrics?range=last_7_days&domain=example.com&event_type=delivered",
      ) as never,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("x-opensend-cache")).toBe("hit");
    expect(mockSelect).not.toHaveBeenCalled();
    expect(mockWriteDashboardAggregateCache).not.toHaveBeenCalled();

    const json = await response.json();
    expect(json.totalEmails).toBe(99);
    expect(mockReadDashboardAggregateCache).toHaveBeenCalledWith(
      "dashboard-aggregate:v1:metrics:last_7_days:example.com:delivered",
    );
  });

  it("writes a fresh aggregate response to cache with a short ttl", async () => {
    const whereArgs: unknown[] = [];
    queueMetricsQueries(whereArgs);

    const metricsRoute = await import("@/app/api/metrics/route");
    const response = await metricsRoute.GET(
      makeNextRequest(
        "http://localhost/api/metrics?range=last_7_days&event_type=opened",
      ) as never,
    );

    expect(response.status).toBe(200);
    expect(mockWriteDashboardAggregateCache).toHaveBeenCalledOnce();
    expect(mockWriteDashboardAggregateCache.mock.calls[0]?.[0]).toBe(
      "dashboard-aggregate:v1:metrics:last_7_days:all:opened",
    );
    expect(mockWriteDashboardAggregateCache.mock.calls[0]?.[2]).toBe(60);
  });
});
