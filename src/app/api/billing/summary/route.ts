import { getServerSession, unauthorizedResponse } from "@/lib/api-auth";
import { isBillingEnabled } from "@/lib/billing";
import { loadBillingSummary } from "@/lib/billing/summary";
import { NextResponse } from "next/server";

export async function GET() {
  if (!isBillingEnabled()) {
    return NextResponse.json(
      { error: "Billing is not enabled" },
      { status: 404 },
    );
  }

  const session = await getServerSession();
  if (!session?.user?.id) return unauthorizedResponse();

  try {
    const summary = await loadBillingSummary(session.user.id);
    if (!summary) {
      return NextResponse.json(
        {
          error:
            "No plan available. Run database seed to create the Free plan.",
        },
        { status: 503 },
      );
    }

    return NextResponse.json({
      object: "billing_summary",
      plan: {
        id: summary.plan.id,
        slug: summary.plan.slug,
        name: summary.plan.name,
        monthly_price_cents: summary.plan.monthlyPriceCents,
        monthly_email_quota: summary.plan.monthlyEmailQuota,
        max_domains: summary.plan.maxDomains,
        max_api_keys: summary.plan.maxApiKeys,
      },
      subscription: summary.subscription
        ? {
            id: summary.subscription.id,
            status: summary.subscription.status,
            current_period_start: summary.subscription.currentPeriodStart,
            current_period_end: summary.subscription.currentPeriodEnd,
            cancel_at_period_end: summary.subscription.cancelAtPeriodEnd,
          }
        : null,
      usage: {
        emails: summary.usage.emails,
        domains: summary.usage.domains,
        api_keys: summary.usage.apiKeys,
        period_start: summary.usage.periodStart,
        period_end: summary.usage.periodEnd,
        has_usage_period: summary.usage.hasUsagePeriod,
      },
    });
  } catch (error) {
    console.error("Failed to load billing summary:", error);
    return NextResponse.json(
      { error: "Failed to load billing summary" },
      { status: 500 },
    );
  }
}
