import type Stripe from "stripe";

export interface BillingSessionUser {
  id: string;
  email?: string | null;
  name?: string | null;
}

export interface BillingPlanForCheckout {
  id: string;
  isPublic: boolean;
  stripePriceId?: string | null;
  stripeOveragePriceId?: string | null;
}

export interface StripeCustomerForBilling {
  stripeCustomerId: string;
}

export interface BillingCheckoutBody {
  plan_id?: unknown;
  planId?: unknown;
}

export interface StripeCustomerCreateInput {
  email?: string;
  name?: string;
  metadata: {
    user_id: string;
  };
}

type StripeCheckoutSessionCreateParams = NonNullable<
  Parameters<InstanceType<typeof Stripe>["checkout"]["sessions"]["create"]>[0]
>;
type StripeCheckoutLineItem = NonNullable<
  StripeCheckoutSessionCreateParams["line_items"]
>[number];

export type StripeCheckoutCreateInput = Pick<
  StripeCheckoutSessionCreateParams,
  | "mode"
  | "customer"
  | "line_items"
  | "success_url"
  | "cancel_url"
  | "metadata"
  | "subscription_data"
>;

function buildSubscriptionCheckoutLineItems(input: {
  basePriceId: string;
  meteredOveragePriceId: string;
}): StripeCheckoutLineItem[] {
  return [
    { price: input.basePriceId, quantity: 1 },
    // Stripe Checkout creates subscription items from subscription-mode
    // recurring line_items. Metered recurring Prices must not send quantity;
    // usage is reported later through Meter Events.
    { price: input.meteredOveragePriceId },
  ];
}

export function buildSubscriptionCheckoutCreateInput(input: {
  customerId: string;
  basePriceId: string;
  meteredOveragePriceId: string;
  successUrl: string;
  cancelUrl: string;
  userId: string;
  planId: string;
}): StripeCheckoutCreateInput {
  const metadata = {
    user_id: input.userId,
    plan_id: input.planId,
  };

  return {
    mode: "subscription",
    customer: input.customerId,
    line_items: buildSubscriptionCheckoutLineItems({
      basePriceId: input.basePriceId,
      meteredOveragePriceId: input.meteredOveragePriceId,
    }),
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    metadata,
    subscription_data: { metadata },
  };
}

export interface StripePortalCreateInput {
  customer: string;
  return_url: string;
}

export interface BillingStripeClient {
  customers: {
    create(input: StripeCustomerCreateInput): Promise<{ id: string }>;
  };
  checkout: {
    sessions: {
      create(
        input: StripeCheckoutCreateInput,
      ): Promise<{ url?: string | null }>;
    };
  };
  billingPortal: {
    sessions: {
      create(input: StripePortalCreateInput): Promise<{ url: string }>;
    };
  };
}

export interface BillingSessionServiceDeps {
  plans: {
    findById(id: string): Promise<BillingPlanForCheckout | null | undefined>;
  };
  stripeCustomers: {
    findByUserId(
      userId: string,
    ): Promise<StripeCustomerForBilling | null | undefined>;
    ensureForUser(
      userId: string,
      stripeCustomerId: string,
    ): Promise<StripeCustomerForBilling>;
  };
  stripe: BillingStripeClient | (() => BillingStripeClient);
}

export type CheckoutSessionResult =
  | { ok: true; url: string }
  | { ok: false; error: "plan_not_found" }
  | { ok: false; error: "stripe_price_missing" }
  | { ok: false; error: "checkout_url_missing" };

export type PortalSessionResult =
  | { ok: true; url: string }
  | { ok: false; error: "stripe_customer_not_found" };

export function normalizeCheckoutPlanId(body: BillingCheckoutBody | null) {
  const planId = body?.plan_id ?? body?.planId;
  if (typeof planId !== "string") return null;

  const trimmed = planId.trim();
  return trimmed ? trimmed : null;
}

export function createBillingSessionService(deps: BillingSessionServiceDeps) {
  function getStripeClient() {
    if (typeof deps.stripe === "function") {
      return deps.stripe();
    }

    return deps.stripe;
  }

  async function ensureStripeCustomer(
    user: BillingSessionUser,
    stripe: BillingStripeClient,
  ) {
    const existing = await deps.stripeCustomers.findByUserId(user.id);
    if (existing) return existing;

    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      name: user.name ?? undefined,
      metadata: {
        user_id: user.id,
      },
    });

    return await deps.stripeCustomers.ensureForUser(user.id, customer.id);
  }

  return {
    async createCheckoutSession(params: {
      planId: string;
      user: BillingSessionUser;
      origin: string;
    }): Promise<CheckoutSessionResult> {
      const plan = await deps.plans.findById(params.planId);
      if (!plan || !plan.isPublic) {
        return { ok: false, error: "plan_not_found" };
      }

      const stripePriceId = plan.stripePriceId ?? "";
      const stripeOveragePriceId = plan.stripeOveragePriceId ?? "";
      if (
        stripePriceId === "" ||
        stripePriceId !== stripePriceId.trim() ||
        stripeOveragePriceId === "" ||
        stripeOveragePriceId !== stripeOveragePriceId.trim()
      ) {
        return { ok: false, error: "stripe_price_missing" };
      }

      const stripe = getStripeClient();
      const customer = await ensureStripeCustomer(params.user, stripe);
      const checkoutSession = await stripe.checkout.sessions.create(
        buildSubscriptionCheckoutCreateInput({
          customerId: customer.stripeCustomerId,
          basePriceId: stripePriceId,
          meteredOveragePriceId: stripeOveragePriceId,
          successUrl: `${params.origin}/settings/billing?status=success`,
          cancelUrl: `${params.origin}/settings/billing?status=cancelled`,
          userId: params.user.id,
          planId: plan.id,
        }),
      );

      if (!checkoutSession.url) {
        return { ok: false, error: "checkout_url_missing" };
      }

      return { ok: true, url: checkoutSession.url };
    },

    async createPortalSession(params: {
      userId: string;
      origin: string;
    }): Promise<PortalSessionResult> {
      const customer = await deps.stripeCustomers.findByUserId(params.userId);
      if (!customer) {
        return { ok: false, error: "stripe_customer_not_found" };
      }

      const portalSession =
        await getStripeClient().billingPortal.sessions.create({
          customer: customer.stripeCustomerId,
          return_url: `${params.origin}/settings/billing`,
        });

      return { ok: true, url: portalSession.url };
    },
  };
}
