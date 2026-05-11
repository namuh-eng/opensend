import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetServerSession = vi.hoisted(() => vi.fn());
const mockGetUsage = vi.hoisted(() => vi.fn());
const mockIsBillingEnabled = vi.hoisted(() => vi.fn());
const mockLoadBillingSummary = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-auth", () => ({
  getServerSession: mockGetServerSession,
  unauthorizedResponse: () =>
    new Response(JSON.stringify({ error: "Missing or invalid API key" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    }),
}));

vi.mock("@/lib/billing", () => ({
  isBillingEnabled: mockIsBillingEnabled,
}));

vi.mock("@/lib/billing/summary", () => ({
  loadBillingSummary: mockLoadBillingSummary,
}));

vi.mock("@opensend/core", () => ({
  createDashboardAggregateService: () => ({
    getUsage: mockGetUsage,
  }),
}));

const usagePayload = {
  plan: { name: "Free", slug: "free" },
  transactional: {
    monthlyUsed: 42,
    monthlyLimit: 3000,
    dailyUsed: 3,
    dailyLimit: 100,
  },
  marketing: {
    contactsUsed: 120,
    contactsLimit: 1000,
    segmentsUsed: 4,
    segmentsLimit: 3,
    broadcastsLimit: "Unlimited",
  },
  team: {
    domainsUsed: 2,
    domainsLimit: 1,
    rateLimit: 2,
  },
};

describe("usage route adapter", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue({
      session: { id: "session-1" },
      user: { id: "user-1" },
    });
    mockGetUsage.mockResolvedValue(usagePayload);
    mockIsBillingEnabled.mockReturnValue(false);
    mockLoadBillingSummary.mockResolvedValue(null);
  });

  it("keeps dashboard auth adapter-side and returns the core usage envelope", async () => {
    const usageRoute = await import("@/app/api/usage/route");
    const response = await usageRoute.GET();

    expect(response.status).toBe(200);
    expect(mockGetUsage).toHaveBeenCalledOnce();
    expect(mockLoadBillingSummary).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual(usagePayload);
  });

  it("uses the billing summary as the source of truth for active plan domain limits", async () => {
    mockIsBillingEnabled.mockReturnValue(true);
    mockLoadBillingSummary.mockResolvedValueOnce({
      plan: {
        id: "plan-pro",
        slug: "pro",
        name: "Pro",
        monthlyPriceCents: 2900,
        monthlyEmailQuota: 50000,
        maxDomains: 10,
        maxApiKeys: 10,
        isPublic: true,
      },
      subscription: null,
      usage: {
        emails: { used: 123, limit: 50000 },
        domains: { used: 4, limit: 10 },
        apiKeys: { used: 1, limit: 10 },
        periodStart: null,
        periodEnd: null,
        hasUsagePeriod: false,
      },
    });

    const usageRoute = await import("@/app/api/usage/route");
    const response = await usageRoute.GET();

    expect(response.status).toBe(200);
    expect(mockLoadBillingSummary).toHaveBeenCalledWith("user-1");
    await expect(response.json()).resolves.toEqual({
      ...usagePayload,
      plan: { name: "Pro", slug: "pro" },
      transactional: {
        ...usagePayload.transactional,
        monthlyLimit: 50000,
      },
      team: {
        ...usagePayload.team,
        domainsUsed: 4,
        domainsLimit: 10,
      },
    });
  });

  it("maps missing sessions and service failures to existing responses", async () => {
    mockGetServerSession.mockResolvedValueOnce(null);
    const usageRoute = await import("@/app/api/usage/route");

    const unauthorized = await usageRoute.GET();
    expect(unauthorized.status).toBe(401);

    mockGetServerSession.mockResolvedValueOnce({
      session: { id: "session-1" },
      user: { id: "user-1" },
    });
    mockGetUsage.mockRejectedValueOnce(new Error("db down"));
    const failed = await usageRoute.GET();
    expect(failed.status).toBe(500);
    await expect(failed.json()).resolves.toEqual({
      error: "Failed to fetch usage data",
    });
  });
});
