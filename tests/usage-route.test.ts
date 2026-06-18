import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetServerSession = vi.hoisted(() => vi.fn());
const mockIsBillingEnabled = vi.hoisted(() => vi.fn());
const mockGetUsage = vi.hoisted(() => vi.fn());

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
  createDefaultBillingSummaryService: () => ({
    getUsage: mockGetUsage,
  }),
}));

const usagePayload = {
  plan: { name: "Free", slug: "free" },
  transactional: {
    monthlyUsed: 42,
    monthlyLimit: 500,
    dailyUsed: 3,
    dailyLimit: 100,
  },
  marketing: {
    contactsUsed: 120,
    contactsLimit: 1000,
    segmentsUsed: 4,
    segmentsLimit: 3,
    broadcastsUsed: 0,
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
    mockIsBillingEnabled.mockReturnValue(false);
    mockGetUsage.mockResolvedValue(usagePayload);
  });

  it("keeps dashboard auth adapter-side and returns the service usage envelope", async () => {
    const usageRoute = await import("@/app/api/usage/route");
    const response = await usageRoute.GET();

    expect(response.status).toBe(200);
    expect(mockGetUsage).toHaveBeenCalledWith({
      billingEnabled: false,
      userId: "user-1",
    });
    await expect(response.json()).resolves.toEqual(usagePayload);
  });

  it("passes billing-enabled state and optional user id to the service", async () => {
    mockIsBillingEnabled.mockReturnValue(true);
    mockGetServerSession.mockResolvedValueOnce({
      session: { id: "session-1" },
      user: null,
    });
    const usageRoute = await import("@/app/api/usage/route");

    const response = await usageRoute.GET();

    expect(response.status).toBe(200);
    expect(mockGetUsage).toHaveBeenCalledWith({
      billingEnabled: true,
      userId: undefined,
    });
    await expect(response.json()).resolves.toEqual(usagePayload);
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
