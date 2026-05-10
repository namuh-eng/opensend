import type { SQL } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockAuthorizeDashboardOrApiKey = vi.hoisted(() => vi.fn());
const mockGetServerSession = vi.hoisted(() => vi.fn());
const mockReadDashboardAggregateCache = vi.hoisted(() => vi.fn());
const mockWriteDashboardAggregateCache = vi.hoisted(() => vi.fn());
const mockBroadcastService = vi.hoisted(() => ({
  listBroadcasts: vi.fn(),
  createBroadcast: vi.fn(),
  getBroadcast: vi.fn(),
  updateBroadcast: vi.fn(),
  deleteBroadcast: vi.fn(),
}));
const MockBroadcastServiceError = vi.hoisted(
  () =>
    class BroadcastServiceError extends Error {
      constructor(
        readonly code: "invalid_input" | "not_found" | "delete_forbidden",
        message: string,
      ) {
        super(message);
        this.name = "BroadcastServiceError";
      }
    },
);
const mockDb = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}));

vi.mock("@/lib/api-auth", () => ({
  authorizeDashboardOrApiKey: mockAuthorizeDashboardOrApiKey,
  getServerSession: mockGetServerSession,
  unauthorizedResponse: () =>
    Response.json({ error: "Missing or invalid API key" }, { status: 401 }),
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

vi.mock("@/lib/db", () => ({
  db: mockDb,
}));

vi.mock("@opensend/core", () => ({
  BroadcastServiceError: MockBroadcastServiceError,
  createBroadcastService: () => mockBroadcastService,
}));

function deepValues(value: unknown, seen = new WeakSet<object>()): unknown[] {
  if (value === null || typeof value !== "object") return [value];
  if (seen.has(value)) return [];
  seen.add(value);

  if (Array.isArray(value)) {
    return value.flatMap((item) => deepValues(item, seen));
  }

  return Object.values(value as Record<string, unknown>).flatMap((item) =>
    deepValues(item, seen),
  );
}

function expectTenantPredicate(
  clause: SQL<unknown> | undefined,
  userId = "user-b",
) {
  expect(clause).toBeDefined();
  const values = deepValues(clause);
  expect(values).toContain("user_id");
  expect(values).toContain(userId);
}

function makeNextRequest(url: string, init?: RequestInit): NextRequest {
  const request = new Request(url, init) as Request & { nextUrl: URL };
  request.nextUrl = new URL(url);
  return request as unknown as NextRequest;
}

function jsonRequest(url: string, body: Record<string, unknown>): NextRequest {
  return makeNextRequest(url, {
    method: "POST",
    headers: {
      Authorization: "Bearer re_test",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

function selectRows<T>(rows: T[], whereClauses: SQL<unknown>[]) {
  const chain = {
    from: vi.fn(() => chain),
    where: vi.fn((clause: SQL<unknown>) => {
      whereClauses.push(clause);
      return chain;
    }),
    orderBy: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    // biome-ignore lint/suspicious/noThenProperty: mocks Drizzle's thenable query builder
    then: (resolve: (value: T[]) => unknown) => Promise.resolve(resolve(rows)),
  };
  return chain;
}

function updateReturning<T>(rows: T[], whereClauses: SQL<unknown>[]) {
  const returning = vi.fn().mockResolvedValue(rows);
  const where = vi.fn((clause: SQL<unknown>) => {
    whereClauses.push(clause);
    return { returning };
  });
  const set = vi.fn(() => ({ where }));
  mockDb.update.mockReturnValue({ set });
  return { set, where, returning };
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
  mockReadDashboardAggregateCache.mockResolvedValue(null);
  mockWriteDashboardAggregateCache.mockResolvedValue(undefined);
});

describe("broadcast tenant isolation", () => {
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

  it("returns 404 for broadcast detail reads outside the tenant", async () => {
    mockBroadcastService.getBroadcast.mockRejectedValueOnce(
      new MockBroadcastServiceError("not_found", "Broadcast not found"),
    );

    const { GET } = await import("@/app/api/broadcasts/[id]/route");
    const response = await GET(
      makeNextRequest("http://localhost:3015/api/broadcasts/broadcast-a", {
        headers: { Authorization: "Bearer re_test" },
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
        headers: { Authorization: "Bearer re_test" },
      }),
      { params: Promise.resolve({ id: "broadcast-1" }) },
    );

    expect(deleteResponse.status).toBe(200);
    expect(mockBroadcastService.deleteBroadcast).toHaveBeenCalledWith(
      "user-b",
      "broadcast-1",
    );
  });

  it("scopes broadcast send ownership checks and status updates", async () => {
    const selectWheres: SQL<unknown>[] = [];
    const updateWheres: SQL<unknown>[] = [];
    mockDb.select.mockReturnValue(
      selectRows([{ id: "broadcast-1", status: "draft" }], selectWheres),
    );
    updateReturning([{ id: "broadcast-1", status: "queued" }], updateWheres);

    const { POST } = await import("@/app/api/broadcasts/[id]/send/route");
    const response = await POST(
      jsonRequest("http://localhost:3015/api/broadcasts/broadcast-1/send", {}),
      { params: Promise.resolve({ id: "broadcast-1" }) },
    );

    expect(response.status).toBe(200);
    expectTenantPredicate(selectWheres.at(-1));
    expectTenantPredicate(updateWheres.at(-1));
  });

  it("scopes broadcast metrics ownership, email aggregation, and cache key", async () => {
    const broadcastWheres: SQL<unknown>[] = [];
    const emailWheres: SQL<unknown>[] = [];
    mockDb.select
      .mockReturnValueOnce(selectRows([{ id: "broadcast-1" }], broadcastWheres))
      .mockReturnValueOnce(
        selectRows(
          [
            {
              total: 2,
              delivered: 2,
              bounced: 0,
              complained: 0,
              opened: 1,
              clicked: 1,
            },
          ],
          emailWheres,
        ),
      );

    const { GET } = await import("@/app/api/broadcasts/[id]/metrics/route");
    const response = await GET(
      makeNextRequest(
        "http://localhost:3015/api/broadcasts/broadcast-1/metrics",
        { headers: { Authorization: "Bearer re_test" } },
      ),
      { params: Promise.resolve({ id: "broadcast-1" }) },
    );

    expect(response.status).toBe(200);
    expectTenantPredicate(broadcastWheres.at(-1));
    expectTenantPredicate(emailWheres.at(-1));
    expect(mockReadDashboardAggregateCache).toHaveBeenCalledWith(
      "dashboard-aggregate:v1:broadcast-metrics:user-b:broadcast-1",
    );
    expect(mockWriteDashboardAggregateCache).toHaveBeenCalledWith(
      "dashboard-aggregate:v1:broadcast-metrics:user-b:broadcast-1",
      expect.objectContaining({ object: "broadcast_metrics" }),
      120,
    );
  });
});
