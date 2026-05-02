import { isBillingEnabled } from "@/lib/billing";
import { listPublicPlans } from "@/lib/billing/summary";
import { NextResponse } from "next/server";

export async function GET() {
  if (!isBillingEnabled()) {
    return NextResponse.json(
      { error: "Billing is not enabled" },
      { status: 404 },
    );
  }

  try {
    const plans = await listPublicPlans();
    return NextResponse.json({
      object: "list",
      data: plans.map((plan) => ({
        object: "plan",
        id: plan.id,
        slug: plan.slug,
        name: plan.name,
        monthly_price_cents: plan.monthlyPriceCents,
        monthly_email_quota: plan.monthlyEmailQuota,
        max_domains: plan.maxDomains,
        max_api_keys: plan.maxApiKeys,
      })),
    });
  } catch (error) {
    console.error("Failed to list public plans:", error);
    return NextResponse.json(
      { error: "Failed to list plans" },
      { status: 500 },
    );
  }
}
