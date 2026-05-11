import { getServerSession } from "@/lib/api-auth";
import { getBillingBackend } from "@/lib/billing";
import { createDefaultBillingSessionService } from "@/lib/billing/session-factory";
import {
  type BillingCheckoutBody,
  normalizeCheckoutPlanId,
} from "@/lib/billing/sessions";
import { NextResponse } from "next/server";

function getRequestOrigin(request: Request) {
  return new URL(request.url).origin;
}

async function readCheckoutBody(request: Request) {
  try {
    return (await request.json()) as BillingCheckoutBody;
  } catch {
    return null;
  }
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
  const planId = normalizeCheckoutPlanId(body);
  if (!planId) {
    return NextResponse.json({ error: "plan_id is required" }, { status: 400 });
  }

  const result =
    await createDefaultBillingSessionService().createCheckoutSession({
      planId,
      user: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
      },
      origin: getRequestOrigin(request),
    });

  if (!result.ok) {
    if (result.error === "plan_not_found") {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    if (result.error === "stripe_price_missing") {
      return NextResponse.json(
        { error: "Plan is not available for Stripe checkout" },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: "Stripe did not return a checkout URL" },
      { status: 502 },
    );
  }

  return NextResponse.json({ url: result.url });
}
