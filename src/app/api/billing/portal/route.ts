import { getServerSession } from "@/lib/api-auth";
import { getBillingBackend } from "@/lib/billing";
import { getStripe } from "@/lib/billing/stripe";
import { stripeCustomerRepo } from "@opensend/core";
import { NextResponse } from "next/server";

function getRequestOrigin(request: Request) {
  return new URL(request.url).origin;
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

  const customer = await stripeCustomerRepo.findByUserId(session.user.id);
  if (!customer) {
    return NextResponse.json(
      { error: "Stripe customer not found" },
      { status: 404 },
    );
  }

  const portalSession = await getStripe().billingPortal.sessions.create({
    customer: customer.stripeCustomerId,
    return_url: `${getRequestOrigin(request)}/settings/billing`,
  });

  return NextResponse.json({ url: portalSession.url });
}
