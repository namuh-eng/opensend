import {
  type PlanRow,
  redactEnvValue,
  validatePlanRows,
  validateStripeEnvironment,
} from "@/lib/billing/cutover-preflight";
import { describe, expect, it } from "vitest";

const basePaidPlan: PlanRow = {
  id: "plan-pro",
  slug: "pro",
  name: "Pro",
  monthly_price_cents: 1900,
  stripe_price_id: "price_test_pro",
  is_public: true,
};

const freePlan: PlanRow = {
  id: "plan-free",
  slug: "free",
  name: "Free",
  monthly_price_cents: 0,
  stripe_price_id: null,
  is_public: true,
};

describe("billing cutover preflight", () => {
  it("requires hosted Stripe env for app and ingester without printing secrets", () => {
    const issues = validateStripeEnvironment(
      {
        BILLING_BACKEND: "stripe",
        STRIPE_SECRET_KEY: "sk_test_123456789",
      },
      "all",
    );

    expect(issues).toEqual([
      expect.objectContaining({
        service: "ingester",
        key: "STRIPE_WEBHOOK_SECRET",
        level: "error",
      }),
    ]);
    expect(redactEnvValue("STRIPE_SECRET_KEY", "sk_test_123456789")).toBe(
      "sk_t…6789",
    );
  });

  it("accepts complete Stripe env for the app service", () => {
    expect(
      validateStripeEnvironment(
        {
          BILLING_BACKEND: " STRIPE ",
          STRIPE_SECRET_KEY: "sk_test_complete",
        },
        "app",
      ),
    ).toHaveLength(0);
  });

  it("flags paid public plans without unique Stripe Price IDs", () => {
    const issues = validatePlanRows([
      freePlan,
      { ...basePaidPlan, stripe_price_id: null },
      {
        ...basePaidPlan,
        id: "plan-scale",
        slug: "scale",
        stripe_price_id: "not_a_price",
      },
      {
        ...basePaidPlan,
        id: "plan-growth",
        slug: "growth",
        stripe_price_id: "not_a_price",
      },
    ]);

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "plans.pro.stripe_price_id",
          level: "error",
        }),
        expect.objectContaining({
          key: "plans.scale.stripe_price_id",
          level: "error",
        }),
        expect.objectContaining({
          key: "plans.stripe_price_id",
          level: "error",
        }),
      ]),
    );
  });

  it("warns when no paid public plans are available for checkout validation", () => {
    expect(validatePlanRows([freePlan])).toEqual([
      expect.objectContaining({
        key: "plans.stripe_price_id",
        level: "warning",
      }),
    ]);
  });

  it("accepts a free plan plus paid public plan mapped to a Stripe Price ID", () => {
    expect(validatePlanRows([freePlan, basePaidPlan])).toHaveLength(0);
  });
});
