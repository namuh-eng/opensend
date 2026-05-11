import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetServerSession = vi.hoisted(() => vi.fn());
const mockGetUsage = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-auth", () => ({
  getServerSession: mockGetServerSession,
  unauthorizedResponse: () =>
    new Response(JSON.stringify({ error: "Missing or invalid API key" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    }),
}));

vi.mock("@opensend/core", () => ({
  createDashboardAggregateService: () => ({
    getUsage: mockGetUsage,
  }),
}));

const usagePayload = {
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
    domainsLimit: 3,
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
  });

  it("keeps dashboard auth adapter-side and returns the core usage envelope", async () => {
    const usageRoute = await import("@/app/api/usage/route");
    const response = await usageRoute.GET();

    expect(response.status).toBe(200);
    expect(mockGetUsage).toHaveBeenCalledOnce();
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
