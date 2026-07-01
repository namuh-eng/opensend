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
      id: "plan-cloud-lite",
      slug: "cloud_lite_15k_monthly",
      name: "Cloud Lite",
      monthly_price_cents: 1500,
      monthly_email_quota: 15000,
      max_domains: 3,
      max_api_keys: 5,
    },
  ],
};

const summaryEnvelope = {
  object: "billing_summary",
  plan: {
    id: "plan-cloud-lite",
    slug: "cloud_lite_15k_monthly",
    name: "Cloud Lite",
    monthly_price_cents: 1500,
    monthly_email_quota: 15000,
    max_domains: 3,
    max_api_keys: 5,
  },
  subscription: {
    id: "sub-1",
    status: "active",
    current_period_start: "2026-05-01T00:00:00.000Z",
    current_period_end: "2026-06-01T00:00:00.000Z",
    cancel_at_period_end: false,
  },
  usage: {
    emails: { used: 123, limit: 15000 },
    domains: { used: 1, limit: 3 },
    api_keys: { used: 1, limit: 5 },
    period_start: "2026-05-01T00:00:00.000Z",
    period_end: "2026-06-01T00:00:00.000Z",
    has_usage_period: true,
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

  it("returns the active paid summary envelope and the no-active-plan response", async () => {
    const { GET } = await importSummaryRoute();

    const response = await GET();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(summaryEnvelope);
    expect(mockGetBillingSummary).toHaveBeenCalledWith("user-1");

    mockGetBillingSummary.mockResolvedValueOnce(null);
    const missing = await GET();
    expect(missing.status).toBe(402);
    await expect(missing.json()).resolves.toEqual({
      error: "No active plan. Subscribe to Lite to use the hosted service.",
      code: "no_active_plan",
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
