import { describe, expect, it, vi } from "vitest";

const mockSelect = vi.hoisted(() => vi.fn());

vi.mock("@opensend/core", () => ({
  createDashboardAggregateService: () => ({ getUsage: vi.fn() }),
}));

vi.mock("@/lib/db", () => ({
  db: { select: mockSelect },
}));

import { isApprovedPublicPlan, listPublicPlans } from "@/lib/billing/summary";

type PlanRow = Parameters<typeof isApprovedPublicPlan>[0];

const basePlan = {
  id: "plan-test",
  slug: "pro",
  name: "Pro",
  monthlyPriceCents: 2900,
  monthlyEmailQuota: 50_000,
  dailyEmailQuota: 5_000,
  maxDomains: 10,
  maxApiKeys: 20,
  maxContacts: 10_000,
  maxSegments: 50,
  maxBroadcasts: null,
  ratePerSecond: 10,
  stripePriceId: "price_test_123",
  stripeOveragePriceId: "price_overage_test_123",
  isPublic: true,
  dedicatedIpsEnabled: false,
  maxDedicatedIps: 0,
  createdAt: new Date("2026-05-01T00:00:00.000Z"),
} satisfies PlanRow;

function plan(overrides: Partial<PlanRow>): PlanRow {
  return { ...basePlan, ...overrides };
}

function mockPublicPlanRows(rows: PlanRow[]) {
  const where = vi.fn().mockResolvedValue(rows);
  const from = vi.fn(() => ({ where }));
  mockSelect.mockReturnValue({ from });
  return { from, where };
}

describe("public billing plan approval", () => {
  it("rejects free or zero-price plans even with public visibility", () => {
    expect(
      isApprovedPublicPlan(
        plan({
          slug: "free",
          name: "Free",
          monthlyPriceCents: 0,
          stripePriceId: null,
          stripeOveragePriceId: null,
          isPublic: true,
        }),
      ),
    ).toBe(false);

    expect(
      isApprovedPublicPlan(
        plan({
          slug: "cloud_lite_15k_monthly",
          monthlyPriceCents: 0,
          stripePriceId: "price_live_123",
          stripeOveragePriceId: "price_overage_123",
          isPublic: true,
        }),
      ),
    ).toBe(false);
  });

  it.each([
    {
      stripePriceId: "price_live_123",
      stripeOveragePriceId: "price_overage_123",
    },
  ])(
    "allows public paid plans with non-empty base and overage Stripe price IDs %#",
    (row) => {
      expect(
        isApprovedPublicPlan(
          plan({
            monthlyPriceCents: 2900,
            stripePriceId: row.stripePriceId,
            stripeOveragePriceId: row.stripeOveragePriceId,
          }),
        ),
      ).toBe(true);
    },
  );

  it("allows a paid row using a non-free public slug", () => {
    expect(
      isApprovedPublicPlan(
        plan({
          slug: "cloud_lite_15k_monthly",
          name: "Cloud Lite",
          monthlyPriceCents: 1500,
          stripePriceId: "price_live_123",
          stripeOveragePriceId: "price_overage_123",
          isPublic: true,
        }),
      ),
    ).toBe(true);
  });

  it.each([
    { monthlyPriceCents: 0, stripePriceId: "price_live_123" },
    { monthlyPriceCents: 2900, stripePriceId: null },
    { monthlyPriceCents: 2900, stripePriceId: "" },
    { monthlyPriceCents: 2900, stripePriceId: "   " },
    { monthlyPriceCents: 2900, stripePriceId: " price_live_123 " },
    { monthlyPriceCents: 2900, stripeOveragePriceId: null },
    { monthlyPriceCents: 2900, stripeOveragePriceId: "" },
    { monthlyPriceCents: 2900, stripeOveragePriceId: "   " },
    { monthlyPriceCents: 2900, stripeOveragePriceId: " price_overage_123 " },
    {
      monthlyPriceCents: 2900,
      stripePriceId: "price_live_123",
      isPublic: false,
    },
  ])("rejects unapproved public paid/placeholder plans %#", (row) => {
    expect(isApprovedPublicPlan(plan(row))).toBe(false);
  });

  it("lists only paid public plans with valid Stripe IDs", async () => {
    const freePlan = plan({
      id: "plan-free",
      slug: "free",
      name: "Free",
      monthlyPriceCents: 0,
      stripePriceId: null,
      stripeOveragePriceId: null,
    });
    const zeroPricePlan = plan({
      id: "plan-zero",
      slug: "zero_price",
      monthlyPriceCents: 0,
      stripePriceId: "price_live_123",
      stripeOveragePriceId: "price_overage_123",
    });
    const paidPlan = plan({
      id: "plan-cloud-lite",
      slug: "cloud_lite_15k_monthly",
      name: "Cloud Lite",
      monthlyPriceCents: 1500,
      monthlyEmailQuota: 15_000,
      maxDomains: 3,
      maxApiKeys: 5,
      stripePriceId: "price_live_123",
      stripeOveragePriceId: "price_overage_123",
    });
    mockPublicPlanRows([freePlan, zeroPricePlan, paidPlan]);

    await expect(listPublicPlans()).resolves.toEqual([
      expect.objectContaining({
        id: "plan-cloud-lite",
        slug: "cloud_lite_15k_monthly",
        name: "Cloud Lite",
        monthlyPriceCents: 1500,
      }),
    ]);
  });
});
