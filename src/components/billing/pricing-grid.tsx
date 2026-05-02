"use client";

import { useState } from "react";

export interface PricingPlan {
  id: string;
  slug: string;
  name: string;
  monthlyPriceCents: number;
  monthlyEmailQuota: number;
  maxDomains: number;
  maxApiKeys: number;
}

interface PricingGridProps {
  plans: PricingPlan[];
  currentPlanId: string | null;
}

function formatPrice(cents: number) {
  if (cents === 0) return "Free";
  return `$${(cents / 100).toFixed(0)}`;
}

function formatNumber(n: number) {
  return n.toLocaleString("en-US");
}

export function PricingGrid({ plans, currentPlanId }: PricingGridProps) {
  const [pendingPlanId, setPendingPlanId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (plans.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-[rgba(176,199,217,0.145)] p-12 text-center text-[14px] text-[#A1A4A5]">
        No public plans available. Run database seed to load the default plan
        catalogue.
      </div>
    );
  }

  const handleUpgrade = async (planId: string) => {
    setPendingPlanId(planId);
    setError(null);

    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan_id: planId }),
      });

      const data: unknown = await response.json().catch(() => null);

      if (response.ok && data && typeof data === "object" && "url" in data) {
        const url = (data as { url: unknown }).url;
        if (typeof url === "string") {
          window.location.href = url;
          return;
        }
      }

      const message =
        data &&
        typeof data === "object" &&
        "message" in data &&
        typeof (data as { message: unknown }).message === "string"
          ? (data as { message: string }).message
          : "Upgrade is unavailable right now.";
      setError(message);
    } catch {
      setError("Upgrade is unavailable right now.");
    } finally {
      setPendingPlanId(null);
    }
  };

  return (
    <div className="space-y-4" data-testid="pricing-grid">
      <div className="grid gap-4 md:grid-cols-3">
        {plans.map((plan) => {
          const isCurrent = plan.id === currentPlanId;
          const isPending = pendingPlanId === plan.id;
          return (
            <article
              key={plan.id}
              className={`flex flex-col rounded-lg border p-6 ${
                isCurrent
                  ? "border-purple-500/60 bg-[rgba(88,28,135,0.12)]"
                  : "border-[rgba(176,199,217,0.145)] bg-[rgba(24,25,28,0.6)]"
              }`}
              data-testid={`pricing-card-${plan.slug}`}
              data-current={isCurrent ? "true" : undefined}
            >
              <header className="mb-4 flex items-baseline justify-between">
                <h3 className="text-[18px] font-semibold text-[#F0F0F0]">
                  {plan.name}
                </h3>
                {isCurrent ? (
                  <span
                    className="rounded-full bg-purple-500/20 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-purple-200"
                    data-testid={`pricing-card-${plan.slug}-current-badge`}
                  >
                    Current Plan
                  </span>
                ) : null}
              </header>
              <div className="mb-4">
                <span className="text-[28px] font-semibold text-[#F0F0F0]">
                  {formatPrice(plan.monthlyPriceCents)}
                </span>
                {plan.monthlyPriceCents > 0 ? (
                  <span className="ml-1 text-[13px] text-[#A1A4A5]">
                    / month
                  </span>
                ) : null}
              </div>
              <ul className="mb-6 flex-1 space-y-2 text-[13px] text-[#A1A4A5]">
                <li>{formatNumber(plan.monthlyEmailQuota)} emails / month</li>
                <li>
                  {formatNumber(plan.maxDomains)}{" "}
                  {plan.maxDomains === 1 ? "domain" : "domains"}
                </li>
                <li>
                  {formatNumber(plan.maxApiKeys)} API{" "}
                  {plan.maxApiKeys === 1 ? "key" : "keys"}
                </li>
              </ul>
              <button
                type="button"
                disabled={isCurrent || isPending}
                onClick={() => handleUpgrade(plan.id)}
                className="rounded-md border border-[rgba(176,199,217,0.145)] bg-[rgba(24,25,28,0.88)] px-3 py-2 text-[13px] font-medium text-[#F0F0F0] transition-colors hover:bg-[rgba(24,25,28,1)] disabled:cursor-not-allowed disabled:opacity-50"
                data-testid={`pricing-card-${plan.slug}-upgrade`}
              >
                {isCurrent
                  ? "Current plan"
                  : isPending
                    ? "Opening checkout…"
                    : "Upgrade"}
              </button>
            </article>
          );
        })}
      </div>
      {error ? (
        <p
          className="text-[13px] text-amber-300"
          role="alert"
          data-testid="pricing-grid-error"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
