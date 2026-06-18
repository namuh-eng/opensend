import { describe, expect, it, vi } from "vitest";

vi.mock("@opensend/core", () => ({
  FREE_PLAN_SLUG: "free",
  createDashboardAggregateService: () => ({ getUsage: vi.fn() }),
}));

import { isApprovedPublicPlan } from "@/lib/billing/summary";

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

describe("public billing plan approval", () => {
  it("allows the canonical public free plan without a Stripe price", () => {
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
    ).toBe(true);
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

  it("rejects a malformed paid row using the canonical free slug", () => {
    expect(
      isApprovedPublicPlan(
        plan({
          slug: "free",
          name: "Free",
          monthlyPriceCents: 2900,
          stripePriceId: "price_live_123",
          isPublic: true,
        }),
      ),
    ).toBe(false);
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
});
