import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFindFirst = vi.hoisted(() => vi.fn());
const mockFindMany = vi.hoisted(() => vi.fn());
const mockSelect = vi.hoisted(() => vi.fn());
const mockInsert = vi.hoisted(() => vi.fn());
const mockUpdate = vi.hoisted(() => vi.fn());
const mockDelete = vi.hoisted(() => vi.fn());
const mockValidateApiKey = vi.hoisted(() => vi.fn());
const mockCountFn = vi.hoisted(() => vi.fn());
const mockValidateDashboardKey = vi.hoisted(() => vi.fn());
const mockGetServerSession = vi.hoisted(() => vi.fn());
const mockAuthorizeDashboardOrApiKey = vi.hoisted(() => vi.fn());

function makeChain<T>(rows: T[]) {
  return {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    onConflictDoNothing: vi.fn().mockReturnThis(),
    onConflictDoUpdate: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue(rows),
    // biome-ignore lint/suspicious/noThenProperty: mocks Drizzle's thenable query builder
    then: (resolve: (value: T[]) => unknown) => Promise.resolve(resolve(rows)),
  };
}

vi.mock("@/lib/db", () => ({
  db: {
    query: {
      apiKeys: { findFirst: mockFindFirst },
      contacts: { findFirst: mockFindFirst, findMany: mockFindMany },
      segments: { findFirst: mockFindFirst },
      topics: { findFirst: mockFindFirst },
      templates: { findFirst: mockFindFirst },
      broadcasts: { findFirst: mockFindFirst },
    },
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
    $count: mockCountFn,
  },
}));

function makeNextRequest(url: string, init?: RequestInit) {
  const request = new Request(url, init) as Request & { nextUrl: URL };
  request.nextUrl = new URL(url);
  return request;
}

describe("lib/api-auth", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.doUnmock("@/lib/api-auth");
    process.env.DASHBOARD_KEY = undefined;
  });

  it("validates a bearer API key by sha256 token hash", async () => {
    const rawKey = "re_test_123";
    const tokenHash = createHash("sha256").update(rawKey).digest("hex");
    mockFindFirst.mockResolvedValue({
      id: "key-1",
      permission: "full_access",
      domain: "example.com",
    });

    const { validateApiKey } = await import("@/lib/api-auth");
    const result = await validateApiKey(`Bearer ${rawKey}`);

    expect(mockFindFirst).toHaveBeenCalledOnce();
    expect(result).toEqual({
      apiKeyId: "key-1",
      permission: "full_access",
      domain: "example.com",
      userId: undefined,
    });
    expect(tokenHash).toHaveLength(64);
  });

  it("returns null for missing, malformed, and unknown API keys", async () => {
    mockFindFirst.mockResolvedValue(null);
    const { validateApiKey } = await import("@/lib/api-auth");

    expect(await validateApiKey(null)).toBeNull();
    expect(await validateApiKey("Basic abc")).toBeNull();
    expect(await validateApiKey("Bearer ")).toBeNull();
    expect(await validateApiKey("Bearer wrong")).toBeNull();
  });

  it("validates the dashboard key from env", async () => {
    process.env.DASHBOARD_KEY = "dashboard-secret";
    const { validateDashboardKey } = await import("@/lib/api-auth");

    expect(validateDashboardKey("Bearer dashboard-secret")).toBe(true);
    expect(validateDashboardKey("Bearer wrong")).toBe(false);
    expect(validateDashboardKey(null)).toBe(false);
  });

  it("fails dashboard validation when env is missing", async () => {
    const { validateDashboardKey } = await import("@/lib/api-auth");
    expect(validateDashboardKey("Bearer dashboard-secret")).toBe(false);
  });

  it("builds the standard unauthorized response", async () => {
    const { unauthorizedResponse } = await import("@/lib/api-auth");
    const response = unauthorizedResponse();

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Missing or invalid API key",
    });
  });
});

describe("lib/date-range", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("covers all presets and custom serialization/parsing", async () => {
    const {
      DATE_RANGE_PRESETS,
      formatDateRangeLabel,
      getDateRangeBounds,
      parseCustomDateRange,
      serializeCustomDateRange,
      toIsoDate,
      isCustomDateRange,
    } = await import("@/lib/date-range");

    expect(DATE_RANGE_PRESETS).toEqual([
      "Today",
      "Yesterday",
      "Last 3 days",
      "Last 7 days",
      "Last 15 days",
      "Last 30 days",
    ]);

    const start = new Date("2026-04-10T12:00:00Z");
    const end = new Date("2026-04-12T12:00:00Z");
    const serialized = serializeCustomDateRange(start, end);
    expect(serialized).toBe("custom:2026-04-10:2026-04-12");
    expect(isCustomDateRange(serialized)).toBe(true);
    expect(parseCustomDateRange(serialized)).toEqual({
      startDate: "2026-04-10",
      endDate: "2026-04-12",
    });
    expect(parseCustomDateRange("custom:2026-04-10")).toBeNull();
    expect(parseCustomDateRange("Today")).toBeNull();
    expect(toIsoDate(new Date("2026-04-01T00:00:00Z"))).toBe("2026-04-01");
    expect(formatDateRangeLabel(serialized)).toBe("Apr 10 - Apr 12");
    expect(formatDateRangeLabel("custom:2026-04-10:2026-04-10")).toBe("Apr 10");

    const customBounds = getDateRangeBounds("custom:2026-04-01:2026-04-03");
    expect(customBounds.start.getDate()).toBe(1);
    expect(customBounds.end.getDate()).toBe(3);
  });

  it("computes preset date bounds", async () => {
    const { getDateRangeBounds } = await import("@/lib/date-range");
    const now = new Date(2026, 3, 23, 15, 45, 30);

    const today = getDateRangeBounds("Today", now);
    expect(today.start.getFullYear()).toBe(2026);
    expect(today.start.getMonth()).toBe(3);
    expect(today.start.getDate()).toBe(23);
    expect(today.start.getHours()).toBe(0);
    expect(today.end.getHours()).toBe(23);
    expect(today.end.getMinutes()).toBe(59);

    const yesterday = getDateRangeBounds("Yesterday", now);
    expect(yesterday.start.getDate()).toBe(22);
    expect(yesterday.end.getDate()).toBe(22);

    const last3 = getDateRangeBounds("Last 3 days", now);
    expect(last3.start.getDate()).toBe(21);
    expect(last3.end.getDate()).toBe(23);

    const last7 = getDateRangeBounds("Last 7 days", now);
    expect(last7.start.getDate()).toBe(17);

    const last15 = getDateRangeBounds("Last 15 days", now);
    expect(last15.start.getDate()).toBe(9);

    const last30 = getDateRangeBounds("Last 30 days", now);
    expect(last30.start.getMonth()).toBe(2);
    expect(last30.start.getDate()).toBe(25);

    const fallback = getDateRangeBounds("weird", now);
    expect(fallback.start.getDate()).toBe(9);
  });
});

describe("route smoke coverage", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.doMock("@/lib/api-auth", async () => {
      const actual =
        await vi.importActual<typeof import("@/lib/api-auth")>(
          "@/lib/api-auth",
        );
      return {
        ...actual,
        validateApiKey: mockValidateApiKey,
        validateDashboardKey: mockValidateDashboardKey,
        getServerSession: mockGetServerSession,
        authorizeDashboardOrApiKey: mockAuthorizeDashboardOrApiKey,
      };
    });
    mockValidateApiKey.mockResolvedValue({
      apiKeyId: "key-1",
      permission: "full_access",
    });
    mockAuthorizeDashboardOrApiKey.mockResolvedValue({
      apiKeyId: "key-1",
      permission: "full_access",
    });
    mockValidateDashboardKey.mockReturnValue(true);
    mockGetServerSession.mockResolvedValue({
      session: { id: "session-1" },
      user: { id: "user-1" },
    });
  });

  it("covers metrics auth failure, session auth, and dashboard key auth", async () => {
    mockValidateDashboardKey.mockReturnValueOnce(false);
    mockGetServerSession.mockResolvedValueOnce(null);
    const metricsRoute = await import("@/app/api/metrics/route");
    const unauthorized = await metricsRoute.GET(
      makeNextRequest("http://localhost/api/metrics") as never,
    );
    expect(unauthorized.status).toBe(401);

    mockValidateDashboardKey.mockReturnValueOnce(false);
    mockSelect
      .mockReturnValueOnce(
        makeChain([
          {
            total: 10,
            delivered: 7,
            bounced: 2,
            hard_bounced: 1,
            soft_bounced: 1,
            undetermined_bounced: 0,
            complained: 1,
          },
        ]),
      )
      .mockReturnValueOnce(makeChain([{ date: "2026-04-23", count: 7 }]))
      .mockReturnValueOnce(
        makeChain([{ date: "2026-04-23", total: 10, bounced: 2 }]),
      )
      .mockReturnValueOnce(
        makeChain([{ date: "2026-04-23", total: 10, complained: 1 }]),
      )
      .mockReturnValueOnce(
        makeChain([
          { domain: "example.com", total: 10, delivered: 7 },
          { domain: null, total: 1, delivered: 1 },
        ]),
      );

    const sessionResponse = await metricsRoute.GET(
      makeNextRequest(
        "http://localhost/api/metrics?range=last_7_days&domain=example.com&event_type=delivered",
      ) as never,
    );

    expect(sessionResponse.status).toBe(200);
    expect(mockGetServerSession).toHaveBeenCalledTimes(2);
    const json = await sessionResponse.json();
    expect(json.totalEmails).toBe(10);
    expect(json.deliverabilityRate).toBe(70);
    expect(json.bounceRate).toBe(20);
    expect(json.complainRate).toBe(10);
    expect(json.domains).toEqual(["example.com"]);
    expect(json.domainBreakdown).toEqual([
      { domain: "example.com", count: 10, rate: 70 },
    ]);

    mockSelect
      .mockReturnValueOnce(
        makeChain([
          {
            total: 0,
            delivered: 0,
            bounced: 0,
            hard_bounced: 0,
            soft_bounced: 0,
            undetermined_bounced: 0,
            complained: 0,
          },
        ]),
      )
      .mockReturnValueOnce(makeChain([]))
      .mockReturnValueOnce(makeChain([]))
      .mockReturnValueOnce(makeChain([]))
      .mockReturnValueOnce(makeChain([]));
    mockValidateDashboardKey.mockReturnValueOnce(true);
    const dashboardKeyResponse = await metricsRoute.GET(
      makeNextRequest("http://localhost/api/metrics", {
        headers: { authorization: "Bearer token" },
      }) as never,
    );

    expect(dashboardKeyResponse.status).toBe(200);
    expect(mockGetServerSession).toHaveBeenCalledTimes(2);
  });

  it("covers usage auth failure, session auth, and dashboard key auth", async () => {
    mockValidateDashboardKey.mockReturnValueOnce(false);
    mockGetServerSession.mockResolvedValueOnce(null);
    const usageRoute = await import("@/app/api/usage/route");
    const unauthorized = await usageRoute.GET(
      makeNextRequest("http://localhost/api/usage"),
    );
    expect(unauthorized.status).toBe(401);

    mockValidateDashboardKey.mockReturnValueOnce(false);
    mockGetServerSession.mockResolvedValueOnce({
      session: { id: "session-1" },
      user: { id: "user-1" },
    });
    mockCountFn.mockResolvedValue(0);
    mockCountFn.mockResolvedValueOnce(42);
    mockCountFn.mockResolvedValueOnce(3);
    mockCountFn.mockResolvedValueOnce(120);
    mockCountFn.mockResolvedValueOnce(4);
    mockCountFn.mockResolvedValueOnce(2);

    const sessionResponse = await usageRoute.GET(
      makeNextRequest("http://localhost/api/usage"),
    );

    expect(sessionResponse.status).toBe(200);
    let json = await sessionResponse.json();
    expect(json.transactional.monthlyUsed).toBe(42);
    expect(json.transactional.dailyUsed).toBe(3);
    expect(json.marketing.contactsUsed).toBe(120);
    expect(json.marketing.segmentsUsed).toBe(4);
    expect(json.team.domainsUsed).toBe(2);

    mockValidateDashboardKey.mockReturnValueOnce(true);
    mockCountFn.mockResolvedValue(0);
    mockCountFn.mockResolvedValueOnce(7);
    mockCountFn.mockResolvedValueOnce(1);
    mockCountFn.mockResolvedValueOnce(8);
    mockCountFn.mockResolvedValueOnce(2);
    mockCountFn.mockResolvedValueOnce(1);

    const dashboardKeyResponse = await usageRoute.GET(
      makeNextRequest("http://localhost/api/usage", {
        headers: { authorization: "Bearer token" },
      }),
    );

    expect(dashboardKeyResponse.status).toBe(200);
    json = await dashboardKeyResponse.json();
    expect(json.transactional.monthlyUsed).toBe(7);
    expect(mockGetServerSession).toHaveBeenCalledTimes(2);
  });

  it("allows dashboard-session auth for audience list routes", async () => {
    mockAuthorizeDashboardOrApiKey.mockResolvedValueOnce({ dashboard: true });
    mockSelect.mockReturnValueOnce(
      makeChain([
        {
          id: "c1",
          email: "alice@example.com",
          firstName: "Alice",
          lastName: "Example",
          unsubscribed: false,
          segments: ["VIP"],
          createdAt: new Date("2026-04-27T00:00:00.000Z"),
        },
      ]),
    );

    const contactsRoute = await import("@/app/api/contacts/route");
    const response = await contactsRoute.GET(
      makeNextRequest("http://localhost/api/contacts"),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      object: "list",
      data: [
        expect.objectContaining({
          email: "alice@example.com",
          status: "subscribed",
        }),
      ],
    });
  });

  it("allows dashboard-session auth for audience create routes", async () => {
    mockAuthorizeDashboardOrApiKey.mockResolvedValue({ dashboard: true });
    mockInsert
      .mockReturnValueOnce(makeChain([{ id: "segment-1", name: "VIP" }]))
      .mockReturnValueOnce(
        makeChain([
          {
            id: "topic-1",
            name: "Product updates",
            description: null,
            defaultSubscription: "opt_out",
            visibility: "public",
            createdAt: new Date("2026-04-27T00:00:00.000Z"),
          },
        ]),
      )
      .mockReturnValueOnce(
        makeChain([
          {
            id: "property-1",
            key: "company",
            name: "Company",
            type: "string",
            fallbackValue: null,
            createdAt: new Date("2026-04-27T00:00:00.000Z"),
            updatedAt: new Date("2026-04-27T00:00:00.000Z"),
          },
        ]),
      );

    const segmentsRoute = await import("@/app/api/segments/route");
    const topicsRoute = await import("@/app/api/topics/route");
    const propertiesRoute = await import("@/app/api/properties/route");

    await expect(
      segmentsRoute.POST(
        makeNextRequest("http://localhost/api/segments", {
          method: "POST",
          body: JSON.stringify({ name: "VIP" }),
        }) as never,
      ),
    ).resolves.toHaveProperty("status", 201);

    await expect(
      topicsRoute.POST(
        makeNextRequest("http://localhost/api/topics", {
          method: "POST",
          body: JSON.stringify({ name: "Product updates" }),
        }) as never,
      ),
    ).resolves.toHaveProperty("status", 201);

    await expect(
      propertiesRoute.POST(
        makeNextRequest("http://localhost/api/properties", {
          method: "POST",
          body: JSON.stringify({ name: "Company" }),
        }) as never,
      ),
    ).resolves.toHaveProperty("status", 201);
  });

  it("covers segments get/post happy path and validation", async () => {
    const route = await import("@/app/api/segments/route");
    const detailRoute = await import("@/app/api/segments/[id]/route");
    const contactsRoute = await import(
      "@/app/api/segments/[id]/contacts/route"
    );

    mockSelect.mockImplementationOnce(() =>
      makeChain([{ id: "seg-1", name: "VIP", createdAt: "2026-04-23" }]),
    );

    mockInsert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: "seg-2", name: "New" }]),
      }),
    });

    const getResponse = await route.GET(
      makeNextRequest("http://localhost/api/segments?limit=20", {
        headers: { authorization: "Bearer token" },
      }) as never,
    );
    expect(getResponse.status).toBe(200);
    const getJson = await getResponse.json();
    expect(getJson.object).toBe("list");

    const invalidPost = await route.POST(
      makeNextRequest("http://localhost/api/segments", {
        method: "POST",
        headers: {
          authorization: "Bearer token",
          "content-type": "application/json",
        },
        body: JSON.stringify({}),
      }) as never,
    );
    expect(invalidPost.status).toBe(400);

    const createResponse = await route.POST(
      makeNextRequest("http://localhost/api/segments", {
        method: "POST",
        headers: {
          authorization: "Bearer token",
          "content-type": "application/json",
        },
        body: JSON.stringify({ name: " New " }),
      }) as never,
    );
    expect(createResponse.status).toBe(201);
    const createJson = await createResponse.json();
    expect(createJson.object).toBe("segment");

    // Detail GET
    mockSelect.mockImplementationOnce(() =>
      makeChain([{ id: "seg-1", name: "VIP" }]),
    );
    const detailGet = await detailRoute.GET(
      makeNextRequest("http://localhost/api/segments/seg-1", {
        headers: { authorization: "Bearer token" },
      }) as never,
      { params: Promise.resolve({ id: "seg-1" }) },
    );
    expect(detailGet.status).toBe(200);

    // Detail DELETE
    mockDelete.mockImplementationOnce(() => makeChain([{ id: "seg-1" }]));
    const detailDelete = await detailRoute.DELETE(
      makeNextRequest("http://localhost/api/segments/seg-1", {
        method: "DELETE",
        headers: { authorization: "Bearer token" },
      }) as never,
      { params: Promise.resolve({ id: "seg-1" }) },
    );
    expect(detailDelete.status).toBe(200);

    // Segment Contacts GET
    mockSelect.mockImplementationOnce(() => makeChain([{ name: "VIP" }])); // Check segment exists
    mockSelect.mockImplementationOnce(() =>
      makeChain([{ id: "c1", email: "a@b.com" }]),
    ); // Contacts list
    mockCountFn.mockResolvedValueOnce(1);

    const contactsGet = await contactsRoute.GET(
      makeNextRequest("http://localhost/api/segments/seg-1/contacts", {
        headers: { authorization: "Bearer token" },
      }) as never,
      { params: Promise.resolve({ id: "seg-1" }) },
    );
    expect(contactsGet.status).toBe(200);
  });

  it("covers topics get/post happy path and validation", async () => {
    const route = await import("@/app/api/topics/route");
    const detailRoute = await import("@/app/api/topics/[id]/route");

    mockSelect.mockImplementationOnce(() =>
      makeChain([
        {
          id: "topic-1",
          name: "Marketing",
          description: "Monthly",
          defaultSubscription: "opt_out",
          visibility: "public",
          createdAt: "2026-04-23T00:00:00.000Z",
        },
      ]),
    );
    mockInsert.mockImplementationOnce(() =>
      makeChain([{ id: "t2", name: "Product", defaultSubscription: "opt_in" }]),
    );

    const getResponse = await route.GET(
      makeNextRequest("http://localhost/api/topics?limit=20", {
        headers: { authorization: "Bearer token" },
      }) as never,
    );
    expect(getResponse.status).toBe(200);
    const getJson = await getResponse.json();
    expect(getJson.object).toBe("list");

    const invalidPost = await route.POST(
      makeNextRequest("http://localhost/api/topics", {
        method: "POST",
        headers: {
          authorization: "Bearer token",
          "content-type": "application/json",
        },
        body: JSON.stringify({}),
      }) as never,
    );
    expect(invalidPost.status).toBe(400);

    const createResponse = await route.POST(
      makeNextRequest("http://localhost/api/topics", {
        method: "POST",
        headers: {
          authorization: "Bearer token",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          name: " Product ",
          description: " docs ",
          default_subscription: "opt_in",
          visibility: "private",
        }),
      }) as never,
    );
    expect(createResponse.status).toBe(201);
    const createJson = await createResponse.json();
    expect(createJson.object).toBe("topic");

    // Detail GET
    mockSelect.mockImplementationOnce(() =>
      makeChain([{ id: "topic-1", name: "Marketing" }]),
    );
    const detailGet = await detailRoute.GET(
      makeNextRequest("http://localhost/api/topics/topic-1", {
        headers: { authorization: "Bearer token" },
      }) as never,
      { params: Promise.resolve({ id: "topic-1" }) },
    );
    expect(detailGet.status).toBe(200);

    // Detail PATCH
    mockUpdate.mockImplementationOnce(() =>
      makeChain([{ id: "topic-1", name: "Updated" }]),
    );
    const detailPatch = await detailRoute.PATCH(
      makeNextRequest("http://localhost/api/topics/topic-1", {
        method: "PATCH",
        headers: {
          authorization: "Bearer token",
          "content-type": "application/json",
        },
        body: JSON.stringify({ name: "Updated" }),
      }) as never,
      { params: Promise.resolve({ id: "topic-1" }) },
    );
    expect(detailPatch.status).toBe(200);

    // Detail DELETE
    mockDelete.mockImplementationOnce(() => makeChain([{ id: "topic-1" }]));
    const detailDelete = await detailRoute.DELETE(
      makeNextRequest("http://localhost/api/topics/topic-1", {
        method: "DELETE",
        headers: { authorization: "Bearer token" },
      }) as never,
      { params: Promise.resolve({ id: "topic-1" }) },
    );
    expect(detailDelete.status).toBe(200);
  });

  it("covers properties get/post responses", async () => {
    const route = await import("@/app/api/properties/route");
    const detailRoute = await import("@/app/api/properties/[id]/route");

    mockCountFn.mockResolvedValueOnce(1);
    mockSelect.mockImplementationOnce(() =>
      makeChain([
        {
          id: "prop-1",
          key: "first_name",
          name: "First Name",
          type: "string",
          fallbackValue: null,
          createdAt: "2026-04-23T00:00:00.000Z",
          updatedAt: "2026-04-23T00:00:00.000Z",
        },
      ]),
    );

    const getResponse = await route.GET(
      makeNextRequest("http://localhost/api/properties", {
        headers: { authorization: "Bearer token" },
      }) as never,
    );
    expect(getResponse.status).toBe(200);
    const getData = await getResponse.json();
    expect(getData.total).toBe(1);
    expect(getData.data[0].key).toBe("first_name");

    mockInsert.mockImplementationOnce(() =>
      makeChain([
        {
          id: "prop-2",
          key: "age",
          name: "Age",
          type: "number",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]),
    );

    const postResponse = await route.POST(
      makeNextRequest("http://localhost/api/properties", {
        method: "POST",
        headers: {
          authorization: "Bearer token",
          "content-type": "application/json",
        },
        body: JSON.stringify({ key: "age", name: "Age", type: "number" }),
      }) as never,
    );
    expect(postResponse.status).toBe(201);

    // Detail GET
    mockSelect.mockImplementationOnce(() =>
      makeChain([{ id: "prop-1", key: "first_name", name: "First Name" }]),
    );
    const detailGet = await detailRoute.GET(
      makeNextRequest("http://localhost/api/properties/prop-1", {
        headers: { authorization: "Bearer token" },
      }) as never,
      { params: Promise.resolve({ id: "prop-1" }) },
    );
    expect(detailGet.status).toBe(200);

    // Detail PATCH
    mockUpdate.mockImplementationOnce(() =>
      makeChain([{ id: "prop-1", name: "New Name" }]),
    );
    const detailPatch = await detailRoute.PATCH(
      makeNextRequest("http://localhost/api/properties/prop-1", {
        method: "PATCH",
        headers: {
          authorization: "Bearer token",
          "content-type": "application/json",
        },
        body: JSON.stringify({ name: "New Name" }),
      }) as never,
      { params: Promise.resolve({ id: "prop-1" }) },
    );
    expect(detailPatch.status).toBe(200);

    // Detail DELETE
    mockDelete.mockImplementationOnce(() => makeChain([{ id: "prop-1" }]));
    const detailDelete = await detailRoute.DELETE(
      makeNextRequest("http://localhost/api/properties/prop-1", {
        method: "DELETE",
        headers: { authorization: "Bearer token" },
      }) as never,
      { params: Promise.resolve({ id: "prop-1" }) },
    );
    expect(detailDelete.status).toBe(200);
  });

  it("covers webhook routes for happy path and 404s", async () => {
    const listRoute = await import("@/app/api/webhooks/route");
    const detailRoute = await import("@/app/api/webhooks/[id]/route");

    mockSelect.mockImplementationOnce(() =>
      makeChain([
        {
          id: "wh-1",
          url: "https://example.com/webhook",
          eventTypes: ["email.sent"],
          status: "active",
          createdAt: "2026-04-23T00:00:00.000Z",
        },
      ]),
    );
    const listRes = await listRoute.GET(
      makeNextRequest("http://localhost/api/webhooks?limit=10", {
        headers: { authorization: "Bearer token" },
      }),
    );
    expect(listRes.status).toBe(200);

    mockInsert.mockImplementationOnce(() =>
      makeChain([
        {
          id: "wh-2",
          url: "https://example.com/created",
          eventTypes: ["email.delivered"],
          status: "active",
          createdAt: "2026-04-23T00:00:00.000Z",
        },
      ]),
    );
    const createRes = await listRoute.POST(
      makeNextRequest("http://localhost/api/webhooks", {
        method: "POST",
        headers: {
          authorization: "Bearer token",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          url: "https://example.com/created",
          event_types: ["email.delivered"],
        }),
      }),
    );
    expect(createRes.status).toBe(201);
    const createJson = await createRes.json();
    expect(createJson.object).toBe("webhook");

    // Detail GET
    mockSelect.mockImplementationOnce(() =>
      makeChain([
        {
          id: "wh-1",
          url: "https://example.com/webhook",
          eventTypes: ["email.sent"],
          status: "active",
          createdAt: "2026-04-23T00:00:00.000Z",
        },
      ]),
    );
    const detailGetRes = await detailRoute.GET(
      makeNextRequest("http://localhost/api/webhooks/wh-1", {
        headers: { authorization: "Bearer token" },
      }),
      { params: Promise.resolve({ id: "wh-1" }) },
    );
    expect(detailGetRes.status).toBe(200);

    mockSelect.mockImplementationOnce(() => makeChain([]));
    const notFoundRes = await detailRoute.GET(
      makeNextRequest("http://localhost/api/webhooks/missing", {
        headers: { authorization: "Bearer token" },
      }),
      { params: Promise.resolve({ id: "missing" }) },
    );
    expect(notFoundRes.status).toBe(404);

    mockUpdate.mockImplementationOnce(() => makeChain([{ id: "wh-1" }]));
    const patchRes = await detailRoute.PATCH(
      makeNextRequest("http://localhost/api/webhooks/wh-1", {
        method: "PATCH",
        headers: {
          authorization: "Bearer token",
          "content-type": "application/json",
        },
        body: JSON.stringify({ active: false }),
      }),
      { params: Promise.resolve({ id: "wh-1" }) },
    );
    expect(patchRes.status).toBe(200);
    const patchJson = await patchRes.json();
    expect(patchJson.object).toBe("webhook");

    mockDelete.mockImplementationOnce(() => makeChain([{ id: "wh-1" }]));
    const deleteRes = await detailRoute.DELETE(
      makeNextRequest("http://localhost/api/webhooks/wh-1", {
        method: "DELETE",
        headers: { authorization: "Bearer token" },
      }),
      { params: Promise.resolve({ id: "wh-1" }) },
    );
    expect(deleteRes.status).toBe(200);
    const deleteJson = await deleteRes.json();
    expect(deleteJson.deleted).toBe(true);
  });

  it("rejects unsupported webhook event types in create and update routes", async () => {
    const listRoute = await import("@/app/api/webhooks/route");
    const detailRoute = await import("@/app/api/webhooks/[id]/route");

    mockInsert.mockClear();
    const createRes = await listRoute.POST(
      makeNextRequest("http://localhost/api/webhooks", {
        method: "POST",
        headers: {
          authorization: "Bearer token",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          endpoint: "https://example.com/webhook",
          events: ["email.unknown"],
        }),
      }),
    );

    expect(createRes.status).toBe(422);
    expect(mockInsert).not.toHaveBeenCalled();

    mockUpdate.mockClear();
    const patchRes = await detailRoute.PATCH(
      makeNextRequest("http://localhost/api/webhooks/wh-1", {
        method: "PATCH",
        headers: {
          authorization: "Bearer token",
          "content-type": "application/json",
        },
        body: JSON.stringify({ event_types: ["delivered"] }),
      }),
      { params: Promise.resolve({ id: "wh-1" }) },
    );

    expect(patchRes.status).toBe(422);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("covers broadcasts and templates detail routes with happy path and 404s", async () => {
    const broadcastsRoute = await import("@/app/api/broadcasts/[id]/route");
    const templatesRoute = await import("@/app/api/templates/[id]/route");

    mockSelect.mockImplementationOnce(() =>
      makeChain([{ id: "b1", name: "Launch" }]),
    );
    expect(
      (
        await broadcastsRoute.GET(
          makeNextRequest("http://localhost/api/broadcasts/b1", {
            headers: { authorization: "Bearer token" },
          }) as never,
          { params: Promise.resolve({ id: "b1" }) },
        )
      ).status,
    ).toBe(200);

    mockSelect.mockImplementationOnce(() => makeChain([]));
    expect(
      (
        await broadcastsRoute.GET(
          makeNextRequest("http://localhost/api/broadcasts/missing", {
            headers: { authorization: "Bearer token" },
          }) as never,
          { params: Promise.resolve({ id: "missing" }) },
        )
      ).status,
    ).toBe(404);

    mockUpdate.mockImplementationOnce(() =>
      makeChain([{ id: "b1", name: "Renamed" }]),
    );
    expect(
      (
        await broadcastsRoute.PATCH(
          makeNextRequest("http://localhost/api/broadcasts/b1", {
            method: "PATCH",
            headers: {
              authorization: "Bearer token",
              "content-type": "application/json",
            },
            body: JSON.stringify({ name: "Renamed" }),
          }) as never,
          { params: Promise.resolve({ id: "b1" }) },
        )
      ).status,
    ).toBe(200);

    mockSelect.mockImplementationOnce(() =>
      makeChain([{ id: "b1", status: "draft" }]),
    );
    mockDelete.mockImplementationOnce(() => makeChain([{ id: "b1" }]));
    const broadcastDeleteRes = await broadcastsRoute.DELETE(
      makeNextRequest("http://localhost/api/broadcasts/b1", {
        method: "DELETE",
        headers: { authorization: "Bearer token" },
      }) as never,
      { params: Promise.resolve({ id: "b1" }) },
    );
    expect(broadcastDeleteRes.status).toBe(200);
    const broadcastDeleteJson = await broadcastDeleteRes.json();
    expect(broadcastDeleteJson.deleted).toBe(true);

    // Send POST
    const sendRoute = await import("@/app/api/broadcasts/[id]/send/route");
    mockSelect.mockImplementationOnce(() =>
      makeChain([{ id: "b1", status: "draft" }]),
    );
    mockUpdate.mockImplementationOnce(() =>
      makeChain([{ id: "b1", status: "queued" }]),
    );
    const sendPost = await sendRoute.POST(
      makeNextRequest("http://localhost/api/broadcasts/b1/send", {
        method: "POST",
        headers: {
          authorization: "Bearer token",
          "content-type": "application/json",
        },
        body: JSON.stringify({}),
      }) as never,
      { params: Promise.resolve({ id: "b1" }) },
    );
    expect(sendPost.status).toBe(200);

    mockSelect.mockImplementationOnce(() =>
      makeChain([{ id: "t1", name: "Receipt" }]),
    );
    expect(
      (
        await templatesRoute.GET(
          makeNextRequest("http://localhost/api/templates/t1", {
            headers: { authorization: "Bearer token" },
          }) as never,
          { params: Promise.resolve({ id: "t1" }) },
        )
      ).status,
    ).toBe(200);

    mockSelect.mockImplementationOnce(() => makeChain([]));
    expect(
      (
        await templatesRoute.GET(
          makeNextRequest("http://localhost/api/templates/missing", {
            headers: { authorization: "Bearer token" },
          }) as never,
          { params: Promise.resolve({ id: "missing" }) },
        )
      ).status,
    ).toBe(404);

    mockUpdate.mockImplementationOnce(() =>
      makeChain([{ id: "t1", name: "Updated" }]),
    );
    expect(
      (
        await templatesRoute.PATCH(
          makeNextRequest("http://localhost/api/templates/t1", {
            method: "PATCH",
            headers: {
              authorization: "Bearer token",
              "content-type": "application/json",
            },
            body: JSON.stringify({ name: "Updated" }),
          }) as never,
          { params: Promise.resolve({ id: "t1" }) },
        )
      ).status,
    ).toBe(200);

    mockDelete.mockImplementationOnce(() => makeChain([{ id: "t1" }]));
    expect(
      (
        await templatesRoute.DELETE(
          makeNextRequest("http://localhost/api/templates/t1", {
            method: "DELETE",
            headers: { authorization: "Bearer token" },
          }) as never,
          { params: Promise.resolve({ id: "t1" }) },
        )
      ).status,
    ).toBe(200);

    // Template actions
    const publishRoute = await import("@/app/api/templates/[id]/publish/route");
    const duplicateRoute = await import(
      "@/app/api/templates/[id]/duplicate/route"
    );

    mockSelect.mockImplementationOnce(() =>
      makeChain([{ id: "t1", status: "draft" }]),
    );
    mockUpdate.mockImplementationOnce(() =>
      makeChain([{ id: "t1", status: "published" }]),
    );
    const publishPost = await publishRoute.POST(
      makeNextRequest("http://localhost/api/templates/t1/publish", {
        method: "POST",
        headers: { authorization: "Bearer token" },
      }) as never,
      { params: Promise.resolve({ id: "t1" }) },
    );
    expect(publishPost.status).toBe(200);

    mockSelect.mockImplementationOnce(() =>
      makeChain([{ id: "t1", name: "Base" }]),
    );
    mockInsert.mockImplementationOnce(() =>
      makeChain([{ id: "t2", name: "Base (Copy)", status: "draft" }]),
    );
    const duplicatePost = await duplicateRoute.POST(
      makeNextRequest("http://localhost/api/templates/t1/duplicate", {
        method: "POST",
        headers: { authorization: "Bearer token" },
      }) as never,
      { params: Promise.resolve({ id: "t1" }) },
    );
    expect(duplicatePost.status).toBe(200);

    // Broadcast Metrics GET
    const metricsRoute = await import(
      "@/app/api/broadcasts/[id]/metrics/route"
    );
    mockSelect.mockImplementationOnce(() => makeChain([{ id: "b1" }])); // Check broadcast exists
    mockSelect.mockReturnValueOnce(
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
    const metricsGet = await metricsRoute.GET(
      makeNextRequest("http://localhost/api/broadcasts/b1/metrics", {
        headers: { authorization: "Bearer token" },
      }) as never,
      { params: Promise.resolve({ id: "b1" }) },
    );
    expect(metricsGet.status).toBe(200);
    const metricsJson = await metricsGet.json();
    expect(metricsJson.object).toBe("broadcast_metrics");
    expect(metricsJson.total).toBe(100);

    // Contact Segments
    const contactSegmentsRoute = await import(
      "@/app/api/contacts/[id]/segments/route"
    );
    const contactSegmentRoute = await import(
      "@/app/api/contacts/[id]/segments/[segment_id]/route"
    );

    mockFindFirst.mockResolvedValueOnce({ id: "c1", segments: ["VIP"] }); // contact
    mockSelect.mockImplementationOnce(() =>
      makeChain([{ id: "s1", name: "VIP" }]),
    ); // segment detail
    const contactSegmentsGet = await contactSegmentsRoute.GET(
      makeNextRequest("http://localhost/api/contacts/c1/segments", {
        headers: { authorization: "Bearer token" },
      }) as never,
      { params: Promise.resolve({ id: "c1" }) },
    );
    expect(contactSegmentsGet.status).toBe(200);

    mockFindFirst.mockResolvedValueOnce({ id: "c1", segments: [] }); // contact
    mockFindFirst.mockResolvedValueOnce({ id: "s1", name: "VIP" }); // segment
    mockInsert.mockImplementationOnce(() => makeChain([]));
    mockUpdate.mockImplementationOnce(() => makeChain([{ id: "c1" }]));
    const contactSegmentPost = await contactSegmentRoute.POST(
      makeNextRequest("http://localhost/api/contacts/c1/segments/s1", {
        method: "POST",
        headers: { authorization: "Bearer token" },
      }) as never,
      { params: Promise.resolve({ id: "c1", segment_id: "s1" }) },
    );
    expect(contactSegmentPost.status).toBe(200);

    // Contact Topics
    const contactTopicsRoute = await import(
      "@/app/api/contacts/[id]/topics/route"
    );
    mockFindFirst.mockResolvedValueOnce({
      id: "c1",
      topicSubscriptions: [{ topicId: "t1", subscribed: true }],
    }); // contact
    mockFindFirst.mockResolvedValueOnce({ id: "t1", name: "News" }); // topic
    const contactTopicsGet = await contactTopicsRoute.GET(
      makeNextRequest("http://localhost/api/contacts/c1/topics", {
        headers: { authorization: "Bearer token" },
      }) as never,
      { params: Promise.resolve({ id: "c1" }) },
    );
    expect(contactTopicsGet.status).toBe(200);

    mockFindFirst.mockResolvedValueOnce({ id: "c1" }); // contact
    mockUpdate.mockImplementationOnce(() => makeChain([{ id: "c1" }]));
    const contactTopicsPatch = await contactTopicsRoute.PATCH(
      makeNextRequest("http://localhost/api/contacts/c1/topics", {
        method: "PATCH",
        headers: { authorization: "Bearer token" },
        body: JSON.stringify({
          topics: [{ id: "t1", subscription: "opt_in" }],
        }),
      }) as never,
      { params: Promise.resolve({ id: "c1" }) },
    );
    expect(contactTopicsPatch.status).toBe(200);

    // Bulk Actions
    const bulkRoute = await import("@/app/api/contacts/bulk/route");
    mockFindFirst.mockResolvedValueOnce({ id: "s1", name: "VIP" }); // segment
    mockFindMany.mockResolvedValueOnce([{ id: "c1", segments: [] }]); // contact
    mockUpdate.mockImplementationOnce(() => makeChain([{ id: "c1" }]));
    const bulkRes = await bulkRoute.POST(
      makeNextRequest("http://localhost/api/contacts/bulk", {
        method: "POST",
        headers: { authorization: "Bearer token" },
        body: JSON.stringify({
          contact_ids: ["c1"],
          segment_id: "s1",
          action: "add_to_segment",
        }),
      }) as never,
    );
    expect(bulkRes.status).toBe(200);
  });
});
