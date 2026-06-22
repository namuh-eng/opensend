import {
  type BillingPlanSummary,
  type BillingSummary,
  createBillingSummaryService,
} from "@/lib/billing/summary";
import { beforeEach, describe, expect, it, vi } from "vitest";

const freePlan: BillingPlanSummary = {
  id: "plan-free",
  slug: "free",
  name: "Free",
  monthlyPriceCents: 0,
  monthlyEmailQuota: 500,
  dailyEmailQuota: 100,
  maxDomains: 1,
  maxApiKeys: 2,
  maxContacts: 1000,
  maxSegments: 3,
  maxBroadcasts: null,
  ratePerSecond: 2,
  isPublic: true,
};

const proSummary: BillingSummary = {
  plan: {
    id: "plan-pro",
    slug: "pro",
    name: "Pro",
    monthlyPriceCents: 2900,
    monthlyEmailQuota: 55000,
    dailyEmailQuota: 5000,
    maxDomains: 10,
    maxApiKeys: 20,
    maxContacts: 10000,
    maxSegments: 50,
    maxBroadcasts: null,
    ratePerSecond: 10,
    isPublic: true,
  },
  subscription: {
    id: "sub-1",
    status: "active",
    currentPeriodStart: "2026-05-01T00:00:00.000Z",
    currentPeriodEnd: "2026-06-01T00:00:00.000Z",
    cancelAtPeriodEnd: false,
  },
  usage: {
    emails: { used: 123, limit: 5000 },
    domains: { used: 4, limit: 10 },
    apiKeys: { used: 3, limit: 20 },
    periodStart: "2026-05-01T00:00:00.000Z",
    periodEnd: "2026-06-01T00:00:00.000Z",
    hasUsagePeriod: true,
  },
};

const baseUsagePayload = {
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
    broadcastsLimit: "Unlimited" as const,
  },
  team: {
    domainsUsed: 2,
    domainsLimit: 1,
    rateLimit: 2,
  },
};

describe("billing summary service", () => {
  const listPlans = vi.fn<() => Promise<BillingPlanSummary[]>>();
  const loadSummary =
    vi.fn<(userId: string) => Promise<BillingSummary | null>>();
  const getDashboardUsage = vi.fn<() => Promise<typeof baseUsagePayload>>();

  beforeEach(() => {
    vi.clearAllMocks();
    listPlans.mockResolvedValue([freePlan, proSummary.plan]);
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
          id: "plan-free",
          slug: "free",
          name: "Free",
          monthly_price_cents: 0,
          monthly_email_quota: 500,
          max_domains: 1,
          max_api_keys: 2,
        },
        {
          object: "plan",
          id: "plan-pro",
          slug: "pro",
          name: "Pro",
          monthly_price_cents: 2900,
          monthly_email_quota: 55000,
          max_domains: 10,
          max_api_keys: 20,
        },
      ],
    });
  });

  it("maps billing summaries into the stable snake_case envelope", async () => {
    const service = createBillingSummaryService({ listPlans, loadSummary });

    await expect(service.getBillingSummary("user-1")).resolves.toEqual({
      object: "billing_summary",
      plan: {
        id: "plan-pro",
        slug: "pro",
        name: "Pro",
        monthly_price_cents: 2900,
        monthly_email_quota: 55000,
        max_domains: 10,
        max_api_keys: 20,
      },
      subscription: {
        id: "sub-1",
        status: "active",
        current_period_start: "2026-05-01T00:00:00.000Z",
        current_period_end: "2026-06-01T00:00:00.000Z",
        cancel_at_period_end: false,
      },
      usage: {
        emails: { used: 123, limit: 5000 },
        domains: { used: 4, limit: 10 },
        api_keys: { used: 3, limit: 20 },
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
      plan: { name: "Pro", slug: "pro" },
      transactional: {
        ...baseUsagePayload.transactional,
        monthlyLimit: 55000,
        dailyLimit: 5000,
      },
      marketing: {
        ...baseUsagePayload.marketing,
        contactsLimit: 10000,
        segmentsLimit: 50,
        broadcastsLimit: "Unlimited",
      },
      team: {
        ...baseUsagePayload.team,
        domainsUsed: 4,
        domainsLimit: 10,
        rateLimit: 10,
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

  it("keeps base dashboard usage when no billing summary exists", async () => {
    loadSummary.mockResolvedValueOnce(null);
    const service = createBillingSummaryService({
      loadSummary,
      dashboardUsage: { getUsage: getDashboardUsage },
    });

    await expect(
      service.getUsage({ billingEnabled: true, userId: "user-1" }),
    ).resolves.toEqual(baseUsagePayload);
  });
});
