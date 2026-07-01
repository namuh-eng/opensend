import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));

import { checkMutationAllowed } from "@/lib/billing/quota";

const STRIPE_ENV = {
  BILLING_BACKEND: "stripe",
  STRIPE_SECRET_KEY: "sk_test_crud",
};
const SELF_HOST_ENV = { BILLING_BACKEND: "disabled" };
const now = new Date("2026-05-15T12:00:00.000Z");

const paidPlan = {
  id: "plan-lite",
  slug: "cloud_lite_15k_monthly",
  monthlyPriceCents: 1000,
  monthlyEmailQuota: 15000,
  maxDomains: 3,
  maxApiKeys: 5,
};
const activeSub = {
  userId: "user-1",
  planId: "plan-lite",
  status: "active",
  currentPeriodStart: new Date("2026-05-01T00:00:00.000Z"),
  currentPeriodEnd: new Date("2026-06-01T00:00:00.000Z"),
};

function fakeDb(sub?: unknown, plan?: unknown) {
  return {
    query: {
      subscriptions: { findFirst: async () => sub ?? undefined },
      plans: { findFirst: async () => plan ?? undefined },
    },
    // biome-ignore lint/suspicious/noExplicitAny: BillingDb test double
  } as any;
}

describe("checkMutationAllowed (hosted CRUD paywall)", () => {
  it("bypasses when no userId", async () => {
    const r = await checkMutationAllowed(null, now, STRIPE_ENV, fakeDb());
    expect(r).toEqual({ ok: true, bypassed: true });
  });

  it("bypasses for self-host (billing disabled)", async () => {
    const r = await checkMutationAllowed(
      "user-1",
      now,
      SELF_HOST_ENV,
      fakeDb(),
    );
    expect(r).toEqual({ ok: true, bypassed: true });
  });

  it("blocks hosted user with no active subscription (402 shape)", async () => {
    const r = await checkMutationAllowed("user-1", now, STRIPE_ENV, fakeDb());
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.info.resource).toBe("mutation");
      expect(r.info.plan).toBe("no_subscription");
      expect(r.info.upgrade_url).toBe("/dashboard/billing");
    }
  });

  it("blocks hosted user on a legacy free plan", async () => {
    const freePlan = {
      ...paidPlan,
      id: "plan-free",
      slug: "free",
      monthlyPriceCents: 0,
    };
    const r = await checkMutationAllowed(
      "user-1",
      now,
      STRIPE_ENV,
      fakeDb({ ...activeSub, planId: "plan-free" }, freePlan),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.info.plan).toBe("legacy_free");
  });

  it("allows hosted user with an active paid subscription", async () => {
    const r = await checkMutationAllowed(
      "user-1",
      now,
      STRIPE_ENV,
      fakeDb(activeSub, paidPlan),
    );
    expect(r).toEqual({ ok: true, bypassed: false });
  });
});
