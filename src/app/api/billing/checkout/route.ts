import { getServerSession } from "@/lib/api-auth";
import { getBillingBackend } from "@/lib/billing";
import { getStripe } from "@/lib/billing/stripe";
import { planRepo, stripeCustomerRepo } from "@opensend/core";
import { NextResponse } from "next/server";
import type Stripe from "stripe";

interface CheckoutRequestBody {
  plan_id?: unknown;
  planId?: unknown;
}

function getRequestOrigin(request: Request) {
  return new URL(request.url).origin;
}

async function readCheckoutBody(request: Request) {
  try {
    return (await request.json()) as CheckoutRequestBody;
  } catch {
    return null;
  }
}

async function ensureStripeCustomer(params: {
  stripe: Stripe;
  userId: string;
  email?: string | null;
  name?: string | null;
}) {
  const existing = await stripeCustomerRepo.findByUserId(params.userId);
  if (existing) return existing;

  const customer = await params.stripe.customers.create({
    email: params.email ?? undefined,
    name: params.name ?? undefined,
    metadata: {
      user_id: params.userId,
    },
  });

  return await stripeCustomerRepo.ensureForUser(params.userId, customer.id);
}

export async function POST(request: Request) {
  if (getBillingBackend() !== "stripe") {
    return NextResponse.json(
      { error: "Billing is not enabled" },
      { status: 404 },
    );
  }

  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await readCheckoutBody(request);
  const planId = body?.plan_id ?? body?.planId;
  if (typeof planId !== "string" || !planId.trim()) {
    return NextResponse.json({ error: "plan_id is required" }, { status: 400 });
  }

  const plan = await planRepo.findById(planId.trim());
  if (!plan || !plan.isPublic) {
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  }

  if (!plan.stripePriceId) {
    return NextResponse.json(
      { error: "Plan is not available for Stripe checkout" },
      { status: 400 },
    );
  }

  const stripe = getStripe();
  const customer = await ensureStripeCustomer({
    stripe,
    userId: session.user.id,
    email: session.user.email,
    name: session.user.name,
  });
  const origin = getRequestOrigin(request);

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customer.stripeCustomerId,
    line_items: [{ price: plan.stripePriceId, quantity: 1 }],
    success_url: `${origin}/settings/billing?status=success`,
    cancel_url: `${origin}/settings/billing?status=cancelled`,
    metadata: {
      user_id: session.user.id,
      plan_id: plan.id,
    },
    subscription_data: {
      metadata: {
        user_id: session.user.id,
        plan_id: plan.id,
      },
    },
  });

  if (!checkoutSession.url) {
    return NextResponse.json(
      { error: "Stripe did not return a checkout URL" },
      { status: 502 },
    );
  }

  return NextResponse.json({ url: checkoutSession.url });
}
