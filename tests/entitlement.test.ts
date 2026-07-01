import { resolveBillingEntitlement } from "@opensend/core";
import { describe, expect, it } from "vitest";

const STRIPE_ENV = {
  BILLING_BACKEND: "stripe",
  STRIPE_SECRET_KEY: "sk_test_entitlement",
};
const SELF_HOST_ENV = { BILLING_BACKEND: "disabled" };
const now = new Date("2026-05-15T12:00:00.000Z");

const paidPlan = {
  id: "plan-lite",
  slug: "cloud_lite_15k_monthly",
  monthlyPriceCents: 1000,
  monthlyEmailQuota: 15000,
};
const freePlan = {
  id: "plan-free",
  slug: "free",
  monthlyPriceCents: 0,
  monthlyEmailQuota: 500,
};

type FakeRows = { sub?: unknown; plan?: unknown };
function fakeDb({ sub, plan }: FakeRows) {
  return {
    query: {
      subscriptions: { findFirst: async () => sub ?? undefined },
      plans: { findFirst: async () => plan ?? undefined },
    },
    // biome-ignore lint/suspicious/noExplicitAny: test double for BillingDb shape
  } as any;
}

const activeSub = {
  userId: "user-1",
  planId: "plan-lite",
  status: "active",
  currentPeriodStart: new Date("2026-05-01T00:00:00.000Z"),
  currentPeriodEnd: new Date("2026-06-01T00:00:00.000Z"),
};

describe("resolveBillingEntitlement", () => {
  it("self_host: billing disabled bypasses everything (no DB read)", async () => {
    const r = await resolveBillingEntitlement(
      "user-1",
      now,
      SELF_HOST_ENV,
      fakeDb({}),
    );
    expect(r).toEqual({ mode: "self_host" });
  });

  it("self_host: stripe backend without secret key is still disabled", async () => {
    const r = await resolveBillingEntitlement(
      "user-1",
      now,
      { BILLING_BACKEND: "stripe" },
      fakeDb({}),
    );
    expect(r.mode).toBe("self_host");
  });

  it("blocked:no_subscription when no subscription row", async () => {
    const r = await resolveBillingEntitlement(
      "user-1",
      now,
      STRIPE_ENV,
      fakeDb({}),
    );
    expect(r).toEqual({ mode: "blocked", reason: "no_subscription" });
  });

  it("blocked:no_subscription when status is not active/trialing/past_due", async () => {
    const r = await resolveBillingEntitlement(
      "user-1",
      now,
      STRIPE_ENV,
      fakeDb({ sub: { ...activeSub, status: "canceled" } }),
    );
    expect(r).toEqual({ mode: "blocked", reason: "no_subscription" });
  });

  it("blocked:past_due when past_due beyond grace", async () => {
    const r = await resolveBillingEntitlement(
      "user-1",
      now,
      STRIPE_ENV,
      fakeDb({
        sub: {
          ...activeSub,
          status: "past_due",
          currentPeriodEnd: new Date("2026-05-01T00:00:00.000Z"), // >3d before now
        },
        plan: paidPlan,
      }),
    );
    expect(r).toEqual({ mode: "blocked", reason: "past_due" });
  });

  it("active when past_due within grace", async () => {
    const r = await resolveBillingEntitlement(
      "user-1",
      now,
      STRIPE_ENV,
      fakeDb({
        sub: {
          ...activeSub,
          status: "past_due",
          currentPeriodEnd: new Date("2026-05-14T12:00:00.000Z"), // 1d before now
        },
        plan: paidPlan,
      }),
    );
    expect(r.mode).toBe("active");
  });

  it("blocked:missing_plan when subscription plan row is absent", async () => {
    const r = await resolveBillingEntitlement(
      "user-1",
      now,
      STRIPE_ENV,
      fakeDb({ sub: activeSub, plan: undefined }),
    );
    expect(r).toEqual({ mode: "blocked", reason: "missing_plan" });
  });

  it("blocked:legacy_free when active subscription resolves a free/zero-price plan", async () => {
    const r = await resolveBillingEntitlement(
      "user-1",
      now,
      STRIPE_ENV,
      fakeDb({ sub: { ...activeSub, planId: "plan-free" }, plan: freePlan }),
    );
    expect(r).toEqual({ mode: "blocked", reason: "legacy_free" });
  });

  it("active with period metadata for an active paid subscription", async () => {
    const r = await resolveBillingEntitlement(
      "user-1",
      now,
      STRIPE_ENV,
      fakeDb({ sub: activeSub, plan: paidPlan }),
    );
    expect(r.mode).toBe("active");
    if (r.mode === "active") {
      expect(r.plan.slug).toBe("cloud_lite_15k_monthly");
      expect(r.periodStart).toEqual(activeSub.currentPeriodStart);
      expect(r.periodEnd).toEqual(activeSub.currentPeriodEnd);
    }
  });
});
