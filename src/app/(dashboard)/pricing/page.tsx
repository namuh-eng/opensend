import { PricingGrid } from "@/components/billing/pricing-grid";
import { getServerSession } from "@/lib/api-auth";
import { isBillingEnabled } from "@/lib/billing";
import { listPublicPlans, loadBillingSummary } from "@/lib/billing/summary";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function PricingPage() {
  if (!isBillingEnabled()) {
    notFound();
  }

  const session = await getServerSession();
  if (!session?.user?.id) {
    redirect("/auth");
  }

  const [plans, summary] = await Promise.all([
    listPublicPlans(),
    loadBillingSummary(session.user.id),
  ]);

  return (
    <div className="space-y-6" data-testid="pricing-page">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[#F0F0F0]">Plans</h1>
          <p className="mt-1 text-[13px] text-[#A1A4A5]">
            Pick the plan that fits your sending volume. You can upgrade or
            downgrade at any time.
          </p>
        </div>
        <Link
          href="/settings/billing"
          className="rounded-md border border-[rgba(176,199,217,0.145)] bg-[rgba(24,25,28,0.88)] px-3 py-1.5 text-[13px] font-medium text-[#F0F0F0] transition-colors hover:bg-[rgba(24,25,28,1)]"
        >
          Back to billing
        </Link>
      </div>

      <PricingGrid
        plans={plans.map((plan) => ({
          id: plan.id,
          slug: plan.slug,
          name: plan.name,
          monthlyPriceCents: plan.monthlyPriceCents,
          monthlyEmailQuota: plan.monthlyEmailQuota,
          maxDomains: plan.maxDomains,
          maxApiKeys: plan.maxApiKeys,
        }))}
        currentPlanId={summary?.plan.id ?? null}
      />
    </div>
  );
}
