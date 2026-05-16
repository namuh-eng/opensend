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
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/85 px-4 py-8 backdrop-blur-sm sm:px-6 lg:px-8"
      data-testid="pricing-page"
    >
      <dialog
        aria-labelledby="billing-plans-title"
        className="relative mx-auto min-h-[calc(100vh-4rem)] max-w-7xl overflow-hidden rounded-[28px] border border-[rgba(176,199,217,0.16)] bg-[#030405] px-5 py-8 shadow-[0_24px_120px_rgba(0,0,0,0.72)] sm:px-8 lg:px-10"
        open={true}
      >
        <Link
          href="/settings/billing"
          aria-label="Close plans"
          className="absolute right-5 top-5 inline-flex h-9 w-9 items-center justify-center rounded-full border border-transparent text-2xl leading-none text-[#A1A4A5] transition-colors hover:border-[rgba(176,199,217,0.18)] hover:bg-[rgba(24,25,28,0.88)] hover:text-[#F0F0F0]"
        >
          ×
        </Link>

        <div className="mx-auto max-w-3xl text-center">
          <h1
            className="text-3xl font-semibold tracking-[-0.03em] text-[#F0F0F0] sm:text-4xl"
            id="billing-plans-title"
          >
            Plans
          </h1>
          <p className="mt-3 text-[14px] leading-6 text-[#A1A4A5]">
            One plan covers API sends, broadcasts, contacts, and domains. You
            can upgrade or downgrade any time.
          </p>
          <div className="mx-auto mt-6 inline-flex rounded-full border border-[rgba(176,199,217,0.12)] bg-[rgba(24,25,28,0.82)] p-1 text-[13px] font-medium text-[#A1A4A5]">
            <span className="rounded-full bg-[#F0F0F0] px-4 py-2 text-[#08090A]">
              API sends + broadcasts
            </span>
          </div>
        </div>

        <div className="mt-10">
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
      </dialog>
    </div>
  );
}
