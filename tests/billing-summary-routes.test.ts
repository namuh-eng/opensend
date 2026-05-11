import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetServerSession = vi.hoisted(() => vi.fn());
const mockIsBillingEnabled = vi.hoisted(() => vi.fn());
const mockListPlans = vi.hoisted(() => vi.fn());
const mockGetBillingSummary = vi.hoisted(() => vi.fn());
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
    listPlans: mockListPlans,
    getBillingSummary: mockGetBillingSummary,
    getUsage: mockGetUsage,
  }),
}));

const plansEnvelope = {
  object: "list",
  data: [
    {
      object: "plan",
      id: "plan-free",
      slug: "free",
      name: "Free",
      monthly_price_cents: 0,
      monthly_email_quota: 3000,
      max_domains: 1,
      max_api_keys: 2,
    },
  ],
};

const summaryEnvelope = {
  object: "billing_summary",
  plan: {
    id: "plan-free",
    slug: "free",
    name: "Free",
    monthly_price_cents: 0,
    monthly_email_quota: 3000,
    max_domains: 1,
    max_api_keys: 2,
  },
  subscription: null,
  usage: {
    emails: { used: null, limit: 3000 },
    domains: { used: 1, limit: 1 },
    api_keys: { used: 1, limit: 2 },
    period_start: null,
    period_end: null,
    has_usage_period: false,
  },
};

async function importPlansRoute() {
  return await import("@/app/api/billing/plans/route");
}

async function importSummaryRoute() {
  return await import("@/app/api/billing/summary/route");
}

describe("billing plans and summary route adapters", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockIsBillingEnabled.mockReturnValue(true);
    mockGetServerSession.mockResolvedValue({ user: { id: "user-1" } });
    mockListPlans.mockResolvedValue(plansEnvelope);
    mockGetBillingSummary.mockResolvedValue(summaryEnvelope);
  });

  it("keeps the billing-disabled plans response and avoids the service", async () => {
    mockIsBillingEnabled.mockReturnValue(false);
    const { GET } = await importPlansRoute();

    const response = await GET();

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "Billing is not enabled",
    });
    expect(mockListPlans).not.toHaveBeenCalled();
  });

  it("returns the plans service envelope and maps failures", async () => {
    const { GET } = await importPlansRoute();

    const response = await GET();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(plansEnvelope);

    mockListPlans.mockRejectedValueOnce(new Error("db down"));
    const failed = await GET();
    expect(failed.status).toBe(500);
    await expect(failed.json()).resolves.toEqual({
      error: "Failed to list plans",
    });
  });

  it("keeps summary billing-disabled and unauthorized responses adapter-side", async () => {
    mockIsBillingEnabled.mockReturnValue(false);
    const { GET } = await importSummaryRoute();

    const disabled = await GET();
    expect(disabled.status).toBe(404);
    await expect(disabled.json()).resolves.toEqual({
      error: "Billing is not enabled",
    });
    expect(mockGetServerSession).not.toHaveBeenCalled();

    mockIsBillingEnabled.mockReturnValue(true);
    mockGetServerSession.mockResolvedValueOnce(null);
    const unauthorized = await GET();
    expect(unauthorized.status).toBe(401);
    await expect(unauthorized.json()).resolves.toEqual({
      error: "Missing or invalid API key",
    });
    expect(mockGetBillingSummary).not.toHaveBeenCalled();
  });

  it("returns the summary service envelope and the missing-plan response", async () => {
    const { GET } = await importSummaryRoute();

    const response = await GET();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(summaryEnvelope);
    expect(mockGetBillingSummary).toHaveBeenCalledWith("user-1");

    mockGetBillingSummary.mockResolvedValueOnce(null);
    const missing = await GET();
    expect(missing.status).toBe(503);
    await expect(missing.json()).resolves.toEqual({
      error: "No plan available. Run database seed to create the Free plan.",
    });
  });

  it("maps unexpected summary failures to the preserved 500 response", async () => {
    mockGetBillingSummary.mockRejectedValueOnce(new Error("db down"));
    const { GET } = await importSummaryRoute();

    const response = await GET();

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Failed to load billing summary",
    });
  });
});
