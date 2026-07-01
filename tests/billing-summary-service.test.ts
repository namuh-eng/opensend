import {
  type BillingPlanSummary,
  type BillingSummary,
  createBillingSummaryService,
} from "@/lib/billing/summary";
import { beforeEach, describe, expect, it, vi } from "vitest";

const paidPlan: BillingPlanSummary = {
  id: "plan-cloud-lite",
  slug: "cloud_lite_15k_monthly",
  name: "Cloud Lite",
  monthlyPriceCents: 1500,
  monthlyEmailQuota: 15_000,
  dailyEmailQuota: 1_000,
  maxDomains: 3,
  maxApiKeys: 5,
  maxContacts: 5000,
  maxSegments: 25,
  maxBroadcasts: null,
  ratePerSecond: 5,
  isPublic: true,
};

const proSummary: BillingSummary = {
  plan: paidPlan,
  subscription: {
    id: "sub-1",
    status: "active",
    currentPeriodStart: "2026-05-01T00:00:00.000Z",
    currentPeriodEnd: "2026-06-01T00:00:00.000Z",
    cancelAtPeriodEnd: false,
  },
  usage: {
    emails: { used: 123, limit: 15000 },
    domains: { used: 4, limit: 3 },
    apiKeys: { used: 3, limit: 5 },
    periodStart: "2026-05-01T00:00:00.000Z",
    periodEnd: "2026-06-01T00:00:00.000Z",
    hasUsagePeriod: true,
  },
};

const baseUsagePayload = {
  plan: { name: "No active plan", slug: "no_active_plan" },
  transactional: {
    monthlyUsed: 42,
    monthlyLimit: 0,
    dailyUsed: 3,
    dailyLimit: 0,
  },
  marketing: {
    contactsUsed: 120,
    contactsLimit: 0,
    segmentsUsed: 4,
    segmentsLimit: 0,
    broadcastsUsed: 0,
    broadcastsLimit: 0,
  },
  team: {
    domainsUsed: 2,
    domainsLimit: 0,
    rateLimit: 0,
  },
};

describe("billing summary service", () => {
  const listPlans = vi.fn<() => Promise<BillingPlanSummary[]>>();
  const loadSummary =
    vi.fn<(userId: string) => Promise<BillingSummary | null>>();
  const getDashboardUsage = vi.fn<() => Promise<typeof baseUsagePayload>>();

  beforeEach(() => {
    vi.clearAllMocks();
    listPlans.mockResolvedValue([paidPlan]);
    loadSummary.mockResolvedValue(proSummary);
    getDashboardUsage.mockResolvedValue(baseUsagePayload);
  });

  it("maps public plans into the stable list envelope", async () => {
    const service = createBillingSummaryService({ listPlans, loadSummary });

    await expect(service.listPlans()).resolves.toEqual({
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
    });
  });

  it("maps active paid billing summaries into the stable snake_case envelope", async () => {
    const service = createBillingSummaryService({ listPlans, loadSummary });

    await expect(service.getBillingSummary("user-1")).resolves.toEqual({
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
        domains: { used: 4, limit: 3 },
        api_keys: { used: 3, limit: 5 },
        period_start: "2026-05-01T00:00:00.000Z",
        period_end: "2026-06-01T00:00:00.000Z",
        has_usage_period: true,
      },
    });
    expect(loadSummary).toHaveBeenCalledWith("user-1");
  });

  it("enriches dashboard usage from billing summary when billing is enabled", async () => {
    const service = createBillingSummaryService({
      loadSummary,
      dashboardUsage: { getUsage: getDashboardUsage },
    });

    await expect(
      service.getUsage({ billingEnabled: true, userId: "user-1" }),
    ).resolves.toEqual({
      ...baseUsagePayload,
      plan: { name: "Cloud Lite", slug: "cloud_lite_15k_monthly" },
      transactional: {
        ...baseUsagePayload.transactional,
        monthlyLimit: 15000,
        dailyLimit: 1000,
      },
      marketing: {
        ...baseUsagePayload.marketing,
        contactsLimit: 5000,
        segmentsLimit: 25,
        broadcastsLimit: "Unlimited",
      },
      team: {
        ...baseUsagePayload.team,
        domainsUsed: 4,
        domainsLimit: 3,
        rateLimit: 5,
      },
    });
    expect(loadSummary).toHaveBeenCalledWith("user-1");
  });

  it.each([
    { billingEnabled: false, userId: "user-1" },
    { billingEnabled: true, userId: null },
  ])("keeps base dashboard usage for %#", async (input) => {
    const service = createBillingSummaryService({
      loadSummary,
      dashboardUsage: { getUsage: getDashboardUsage },
    });

    await expect(service.getUsage(input)).resolves.toEqual(baseUsagePayload);
    expect(loadSummary).not.toHaveBeenCalled();
  });

  it("keeps base dashboard usage and surfaces no active plan when no billing summary exists", async () => {
    loadSummary.mockResolvedValueOnce(null);
    loadSummary.mockResolvedValueOnce(null);
    const service = createBillingSummaryService({
      loadSummary,
      dashboardUsage: { getUsage: getDashboardUsage },
    });

    await expect(
      service.getUsage({ billingEnabled: true, userId: "user-1" }),
    ).resolves.toEqual(baseUsagePayload);
    await expect(service.getBillingSummary("user-1")).resolves.toBeNull();
  });
});
