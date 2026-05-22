import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocks ────────────────────────────────────────────────────────────────────
const mockGetServerSession = vi.hoisted(() => vi.fn());
const mockAuthorizeDashboardOrApiKey = vi.hoisted(() => vi.fn());
const mockUnauthorizedResponse = vi.hoisted(
  () => () =>
    new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
);
const mockListForUser = vi.hoisted(() => vi.fn());
const mockCountForUser = vi.hoisted(() => vi.fn());
const mockCreate = vi.hoisted(() => vi.fn());
const mockCreateDedicatedIpPool = vi.hoisted(() => vi.fn());
const mockFindBySubscription = vi.hoisted(() => vi.fn());
const mockFindByPlanId = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-auth", () => ({
  authorizeDashboardOrApiKey: mockAuthorizeDashboardOrApiKey,
  getServerSession: mockGetServerSession,
  unauthorizedResponse: mockUnauthorizedResponse,
}));

vi.mock("@/lib/db", () => ({
  db: {
    query: {
      subscriptions: { findFirst: mockFindBySubscription },
      plans: { findFirst: mockFindByPlanId },
    },
  },
}));

vi.mock("@/lib/db/schema", () => ({
  plans: {},
  subscriptions: {},
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
}));

vi.mock("@opensend/core", () => ({
  dedicatedIpPoolRepo: {
    listForUser: mockListForUser,
    countForUser: mockCountForUser,
    create: mockCreate,
  },
  configurationSetService: {
    createDedicatedIpPool: mockCreateDedicatedIpPool,
    deleteDedicatedIpPool: vi.fn(),
  },
}));

vi.mock("zod", async (importOriginal) => {
  return await importOriginal();
});

import { GET, POST } from "@/app/api/dedicated-ips/route";

const SESSION = { user: { id: "user-1", email: "test@example.com" } };

describe("GET /api/dedicated-ips", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockAuthorizeDashboardOrApiKey.mockResolvedValueOnce(null);
    const req = new Request("http://localhost/api/dedicated-ips");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns empty list when no pools", async () => {
    mockAuthorizeDashboardOrApiKey.mockResolvedValueOnce({ dashboard: true });
    mockGetServerSession.mockResolvedValueOnce(SESSION);
    mockListForUser.mockResolvedValueOnce([]);

    const req = new Request("http://localhost/api/dedicated-ips");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual([]);
    expect(body.object).toBe("list");
  });
});

describe("POST /api/dedicated-ips — plan gating", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockAuthorizeDashboardOrApiKey.mockResolvedValueOnce(null);
    const req = new Request("http://localhost/api/dedicated-ips", {
      method: "POST",
      body: JSON.stringify({ name: "Pool", ses_pool_name: "ses-pool" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 403 when plan has dedicatedIpsEnabled=false", async () => {
    mockAuthorizeDashboardOrApiKey.mockResolvedValueOnce({ dashboard: true });
    mockGetServerSession.mockResolvedValueOnce(SESSION);
    mockFindBySubscription.mockResolvedValueOnce({ planId: "plan-free" });
    mockFindByPlanId.mockResolvedValueOnce({
      id: "plan-free",
      dedicatedIpsEnabled: false,
      maxDedicatedIps: 0,
    });

    const req = new Request("http://localhost/api/dedicated-ips", {
      method: "POST",
      body: JSON.stringify({ name: "Pool", ses_pool_name: "ses-pool" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe("plan_feature_unavailable");
  });

  it("returns 402 when pool limit reached", async () => {
    mockAuthorizeDashboardOrApiKey.mockResolvedValueOnce({ dashboard: true });
    mockGetServerSession.mockResolvedValueOnce(SESSION);
    mockFindBySubscription.mockResolvedValueOnce({ planId: "plan-pro" });
    mockFindByPlanId.mockResolvedValueOnce({
      id: "plan-pro",
      dedicatedIpsEnabled: true,
      maxDedicatedIps: 1,
    });
    mockCountForUser.mockResolvedValueOnce(1); // already at limit

    const req = new Request("http://localhost/api/dedicated-ips", {
      method: "POST",
      body: JSON.stringify({ name: "Pool", ses_pool_name: "ses-pool" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.code).toBe("quota_exceeded");
  });

  it("creates pool and returns 201 when plan allows it", async () => {
    mockAuthorizeDashboardOrApiKey.mockResolvedValueOnce({ dashboard: true });
    mockGetServerSession.mockResolvedValueOnce(SESSION);
    mockFindBySubscription.mockResolvedValueOnce({ planId: "plan-pro" });
    mockFindByPlanId.mockResolvedValueOnce({
      id: "plan-pro",
      dedicatedIpsEnabled: true,
      maxDedicatedIps: 5,
    });
    mockCountForUser.mockResolvedValueOnce(0);
    mockCreateDedicatedIpPool.mockResolvedValueOnce(undefined);
    mockCreate.mockResolvedValueOnce({
      id: "pool-1",
      userId: "user-1",
      name: "Pool",
      sesPoolName: "ses-pool",
      scalingMode: "MANAGED",
      status: "active",
      createdAt: new Date(),
    });

    const req = new Request("http://localhost/api/dedicated-ips", {
      method: "POST",
      body: JSON.stringify({ name: "Pool", ses_pool_name: "ses-pool" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.object).toBe("dedicated_ip_pool");
    expect(body.ses_pool_name).toBe("ses-pool");
  });
});
