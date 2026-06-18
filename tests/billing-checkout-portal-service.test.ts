import {
  type BillingPlanForCheckout,
  type BillingSessionServiceDeps,
  type StripeCheckoutCreateInput,
  type StripeCustomerCreateInput,
  type StripePortalCreateInput,
  buildSubscriptionCheckoutCreateInput,
  createBillingSessionService,
  normalizeCheckoutPlanId,
} from "@/lib/billing/sessions";
import { describe, expect, it } from "vitest";

const testUser = {
  id: "user_123",
  email: "owner@example.com",
  name: "Owner Example",
};

interface FakeState {
  plan?: BillingPlanForCheckout | null;
  customer?: { stripeCustomerId: string } | null;
  createdCustomerId?: string;
  checkoutUrl?: string | null;
  portalUrl?: string;
}

function fakeDeps(state: FakeState = {}) {
  const calls = {
    planFindIds: [] as string[],
    customerFindUserIds: [] as string[],
    customerCreates: [] as StripeCustomerCreateInput[],
    customerEnsures: [] as Array<{
      userId: string;
      stripeCustomerId: string;
    }>,
    checkoutCreates: [] as StripeCheckoutCreateInput[],
    portalCreates: [] as StripePortalCreateInput[],
    stripeFactoryCalls: 0,
  };

  const deps: BillingSessionServiceDeps = {
    plans: {
      async findById(id) {
        calls.planFindIds.push(id);
        return state.plan;
      },
    },
    stripeCustomers: {
      async findByUserId(userId) {
        calls.customerFindUserIds.push(userId);
        return state.customer;
      },
      async ensureForUser(userId, stripeCustomerId) {
        calls.customerEnsures.push({ userId, stripeCustomerId });
        return { stripeCustomerId };
      },
    },
    stripe: () => {
      calls.stripeFactoryCalls += 1;
      return {
        customers: {
          async create(input) {
            calls.customerCreates.push(input);
            return { id: state.createdCustomerId ?? "cus_new" };
          },
        },
        checkout: {
          sessions: {
            async create(input) {
              calls.checkoutCreates.push(input);
              return { url: state.checkoutUrl };
            },
          },
        },
        billingPortal: {
          sessions: {
            async create(input) {
              calls.portalCreates.push(input);
              return {
                url: state.portalUrl ?? "https://billing.example/session",
              };
            },
          },
        },
      };
    },
  };

  return { calls, service: createBillingSessionService(deps) };
}

describe("Stripe subscription Checkout payload", () => {
  it("adds base and metered recurring prices as Checkout line items without a metered quantity", () => {
    const payload = buildSubscriptionCheckoutCreateInput({
      customerId: "cus_123",
      basePriceId: "price_base_123",
      meteredOveragePriceId: "price_metered_overage_123",
      successUrl: "https://app.opensend.test/settings/billing?status=success",
      cancelUrl: "https://app.opensend.test/settings/billing?status=cancelled",
      userId: "user_123",
      planId: "plan_pro",
    });

    expect(payload).toEqual({
      mode: "subscription",
      customer: "cus_123",
      line_items: [
        { price: "price_base_123", quantity: 1 },
        { price: "price_metered_overage_123" },
      ],
      success_url: "https://app.opensend.test/settings/billing?status=success",
      cancel_url: "https://app.opensend.test/settings/billing?status=cancelled",
      metadata: { user_id: "user_123", plan_id: "plan_pro" },
      subscription_data: {
        metadata: { user_id: "user_123", plan_id: "plan_pro" },
      },
    });
    expect(payload.line_items?.[1]).not.toHaveProperty("quantity");
    expect(payload.subscription_data).not.toHaveProperty("items");
  });
});

describe("billing checkout and portal session service", () => {
  it("normalizes the checkout plan ID with the existing plan_id precedence", () => {
    expect(normalizeCheckoutPlanId({ plan_id: " plan_pro " })).toBe("plan_pro");
    expect(normalizeCheckoutPlanId({ planId: " plan_legacy " })).toBe(
      "plan_legacy",
    );
    expect(
      normalizeCheckoutPlanId({ plan_id: " ", planId: "plan_fallback" }),
    ).toBeNull();
    expect(normalizeCheckoutPlanId({ plan_id: 123 })).toBeNull();
    expect(normalizeCheckoutPlanId(null)).toBeNull();
  });

  it("returns plan_not_found for missing or private checkout plans before touching Stripe", async () => {
    for (const plan of [
      null,
      { id: "plan_private", isPublic: false, stripePriceId: "price_private" },
    ]) {
      const { calls, service } = fakeDeps({ plan });

      await expect(
        service.createCheckoutSession({
          planId: "plan_private",
          user: testUser,
          origin: "https://app.opensend.test",
        }),
      ).resolves.toEqual({ ok: false, error: "plan_not_found" });

      expect(calls.planFindIds).toEqual(["plan_private"]);
      expect(calls.customerFindUserIds).toEqual([]);
      expect(calls.stripeFactoryCalls).toBe(0);
    }
  });

  it("returns stripe_price_missing when a public plan has no Stripe price", async () => {
    const { calls, service } = fakeDeps({
      plan: { id: "plan_free", isPublic: true, stripePriceId: null },
    });

    await expect(
      service.createCheckoutSession({
        planId: "plan_free",
        user: testUser,
        origin: "https://app.opensend.test",
      }),
    ).resolves.toEqual({ ok: false, error: "stripe_price_missing" });

    expect(calls.customerFindUserIds).toEqual([]);
    expect(calls.stripeFactoryCalls).toBe(0);
  });

  it("creates a customer and subscription checkout session with base and overage prices", async () => {
    const { calls, service } = fakeDeps({
      plan: {
        id: "plan_pro",
        isPublic: true,
        stripePriceId: "price_123",
        stripeOveragePriceId: "price_overage_123",
      },
      customer: null,
      createdCustomerId: "cus_new",
      checkoutUrl: "https://checkout.stripe.com/c/pay/cs_test_123",
    });

    await expect(
      service.createCheckoutSession({
        planId: "plan_pro",
        user: testUser,
        origin: "https://app.opensend.test",
      }),
    ).resolves.toEqual({
      ok: true,
      url: "https://checkout.stripe.com/c/pay/cs_test_123",
    });

    expect(calls.customerCreates).toEqual([
      {
        email: "owner@example.com",
        name: "Owner Example",
        metadata: { user_id: "user_123" },
      },
    ]);
    expect(calls.customerEnsures).toEqual([
      { userId: "user_123", stripeCustomerId: "cus_new" },
    ]);
    expect(calls.checkoutCreates).toEqual([
      {
        mode: "subscription",
        customer: "cus_new",
        line_items: [
          { price: "price_123", quantity: 1 },
          { price: "price_overage_123" },
        ],
        success_url:
          "https://app.opensend.test/settings/billing?status=success",
        cancel_url:
          "https://app.opensend.test/settings/billing?status=cancelled",
        metadata: { user_id: "user_123", plan_id: "plan_pro" },
        subscription_data: {
          metadata: { user_id: "user_123", plan_id: "plan_pro" },
        },
      },
    ]);
  });

  it("returns stripe_price_missing when a paid checkout plan has no overage price", async () => {
    const { calls, service } = fakeDeps({
      plan: { id: "plan_pro", isPublic: true, stripePriceId: "price_123" },
      customer: { stripeCustomerId: "cus_existing" },
    });

    await expect(
      service.createCheckoutSession({
        planId: "plan_pro",
        user: testUser,
        origin: "https://app.opensend.test",
      }),
    ).resolves.toEqual({ ok: false, error: "stripe_price_missing" });

    expect(calls.checkoutCreates).toEqual([]);
    expect(calls.stripeFactoryCalls).toBe(0);
  });

  it("returns stripe_price_missing for checkout plans with unapproved price formatting", async () => {
    for (const plan of [
      {
        id: "plan_pro",
        isPublic: true,
        stripePriceId: " price_123 ",
        stripeOveragePriceId: "price_overage_123",
      },
      {
        id: "plan_pro",
        isPublic: true,
        stripePriceId: "price_123",
        stripeOveragePriceId: " price_overage_123 ",
      },
    ]) {
      const { calls, service } = fakeDeps({ plan });

      await expect(
        service.createCheckoutSession({
          planId: "plan_pro",
          user: testUser,
          origin: "https://app.opensend.test",
        }),
      ).resolves.toEqual({ ok: false, error: "stripe_price_missing" });

      expect(calls.checkoutCreates).toEqual([]);
      expect(calls.stripeFactoryCalls).toBe(0);
    }
  });

  it("reuses an existing customer and reports a missing checkout URL", async () => {
    const { calls, service } = fakeDeps({
      plan: {
        id: "plan_pro",
        isPublic: true,
        stripePriceId: "price_123",
        stripeOveragePriceId: "price_overage_123",
      },
      customer: { stripeCustomerId: "cus_existing" },
      checkoutUrl: null,
    });

    await expect(
      service.createCheckoutSession({
        planId: "plan_pro",
        user: testUser,
        origin: "https://app.opensend.test",
      }),
    ).resolves.toEqual({ ok: false, error: "checkout_url_missing" });

    expect(calls.customerCreates).toEqual([]);
    expect(calls.checkoutCreates[0]?.customer).toBe("cus_existing");
  });

  it("returns stripe_customer_not_found for portal when the user has no customer", async () => {
    const { calls, service } = fakeDeps({ customer: null });

    await expect(
      service.createPortalSession({
        userId: "user_123",
        origin: "https://app.opensend.test",
      }),
    ).resolves.toEqual({ ok: false, error: "stripe_customer_not_found" });

    expect(calls.portalCreates).toEqual([]);
    expect(calls.stripeFactoryCalls).toBe(0);
  });

  it("creates a billing portal session with the current return URL", async () => {
    const { calls, service } = fakeDeps({
      customer: { stripeCustomerId: "cus_existing" },
      portalUrl: "https://billing.stripe.com/p/session/test_123",
    });

    await expect(
      service.createPortalSession({
        userId: "user_123",
        origin: "https://app.opensend.test",
      }),
    ).resolves.toEqual({
      ok: true,
      url: "https://billing.stripe.com/p/session/test_123",
    });

    expect(calls.portalCreates).toEqual([
      {
        customer: "cus_existing",
        return_url: "https://app.opensend.test/settings/billing",
      },
    ]);
  });
});
