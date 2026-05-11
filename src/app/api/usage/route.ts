import { getServerSession, unauthorizedResponse } from "@/lib/api-auth";
import { isBillingEnabled } from "@/lib/billing";
import { loadBillingSummary } from "@/lib/billing/summary";
import { createDashboardAggregateService } from "@opensend/core";
import { NextResponse } from "next/server";

const dashboardAggregateService = createDashboardAggregateService();

// Dashboard-only internal endpoint
export async function GET() {
  const session = await getServerSession();
  if (!session) return unauthorizedResponse();

  try {
    const payload = await dashboardAggregateService.getUsage();

    if (!isBillingEnabled() || !session.user?.id) {
      return NextResponse.json(payload);
    }

    const billingSummary = await loadBillingSummary(session.user.id);
    if (!billingSummary) return NextResponse.json(payload);

    return NextResponse.json({
      ...payload,
      plan: {
        name: billingSummary.plan.name,
        slug: billingSummary.plan.slug,
      },
      transactional: {
        ...payload.transactional,
        monthlyLimit: billingSummary.plan.monthlyEmailQuota,
      },
      team: {
        ...payload.team,
        domainsUsed: billingSummary.usage.domains.used,
        domainsLimit: billingSummary.usage.domains.limit,
      },
    });
  } catch (error) {
    console.error("Failed to fetch usage:", error);
    return NextResponse.json(
      { error: "Failed to fetch usage data" },
      { status: 500 },
    );
  }
}
