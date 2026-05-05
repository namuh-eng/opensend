import {
  BillingView,
  type BillingViewSummary,
} from "@/components/billing/billing-view";
import { getServerSession } from "@/lib/api-auth";
import { isBillingEnabled } from "@/lib/billing";
import { loadBillingSummary } from "@/lib/billing/summary";
import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function BillingSettingsPage() {
  if (!isBillingEnabled()) {
    notFound();
  }

  const session = await getServerSession();
  if (!session?.user?.id) {
    redirect("/auth");
  }

  const summary = await loadBillingSummary(session.user.id);
  if (!summary) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold text-[#F0F0F0]">Billing</h1>
        <p className="text-[14px] text-[#A1A4A5]">
          No plan record was found. Run the database seed to create the Free
          plan.
        </p>
      </div>
    );
  }

  const initial: BillingViewSummary = {
    plan: {
      id: summary.plan.id,
      slug: summary.plan.slug,
      name: summary.plan.name,
      monthlyPriceCents: summary.plan.monthlyPriceCents,
      monthlyEmailQuota: summary.plan.monthlyEmailQuota,
      maxDomains: summary.plan.maxDomains,
      maxApiKeys: summary.plan.maxApiKeys,
    },
    subscription: summary.subscription
      ? {
          id: summary.subscription.id,
          status: summary.subscription.status,
          currentPeriodStart: summary.subscription.currentPeriodStart,
          currentPeriodEnd: summary.subscription.currentPeriodEnd,
          cancelAtPeriodEnd: summary.subscription.cancelAtPeriodEnd,
        }
      : null,
    usage: {
      emails: summary.usage.emails,
      domains: summary.usage.domains,
      apiKeys: summary.usage.apiKeys,
      periodStart: summary.usage.periodStart,
      periodEnd: summary.usage.periodEnd,
      hasUsagePeriod: summary.usage.hasUsagePeriod,
    },
  };

  return <BillingView initial={initial} />;
}
