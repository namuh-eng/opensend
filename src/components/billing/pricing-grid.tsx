"use client";

import {
  PricingPlanCard,
  PricingTierSelector,
} from "@/components/pricing/pricing-card";
import {
  DEFAULT_PRICING_TIER_SLUG,
  type PricingDisplayPlan,
  type PricingTierSlug,
  findPricingTier,
  getPricingCardsForSelection,
  isPricingTierSlug,
} from "@/components/pricing/pricing-catalog";
import { useMemo, useState } from "react";

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

function formatPrice(plan: PricingDisplayPlan) {
  if (plan.monthlyPrice === null) return "custom";
  if (plan.monthlyPrice === 0) return "Free";
  return `$${plan.monthlyPrice}`;
}

function defaultSelectedTier(
  plans: PricingPlan[],
  currentPlanId: string | null,
) {
  const current = plans.find((plan) => plan.id === currentPlanId);
  if (current && isPricingTierSlug(current.slug)) return current.slug;
  return DEFAULT_PRICING_TIER_SLUG;
}

export function PricingGrid({ plans, currentPlanId }: PricingGridProps) {
  const [pendingPlanId, setPendingPlanId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedTierSlug, setSelectedTierSlug] = useState<PricingTierSlug>(
    () => defaultSelectedTier(plans, currentPlanId),
  );

  const plansBySlug = useMemo(
    () => new Map(plans.map((plan) => [plan.slug, plan] as const)),
    [plans],
  );

  if (plans.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-line p-12 text-center text-[14px] text-fg-2">
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
    <div
      className="landing-root space-y-8"
      data-testid="pricing-grid"
      style={{ background: "transparent", minHeight: "auto" }}
    >
      <div className="flex justify-center">
        <PricingTierSelector
          selectedSlug={selectedTierSlug}
          onChange={setSelectedTierSlug}
        />
      </div>
      <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-4">
        {getPricingCardsForSelection(selectedTierSlug).map((displayPlan) => {
          const dbPlan = plansBySlug.get(displayPlan.slug);
          const current = dbPlan?.id === currentPlanId;
          const pending = dbPlan ? pendingPlanId === dbPlan.id : false;
          const persistedPlan = findPricingTier(displayPlan.slug);
          const checkoutDisabled =
            displayPlan.checkoutKind === "stripe" && !dbPlan;
          const ctaLabel = current
            ? "Current plan"
            : checkoutDisabled
              ? "Unavailable"
              : displayPlan.checkoutKind === "stripe"
                ? `Change to ${displayPlan.name} (${formatPrice(displayPlan)} / mo)`
                : displayPlan.checkoutKind === "free"
                  ? "Contact support"
                  : displayPlan.cta;
          const onAction = current
            ? () => undefined
            : dbPlan && displayPlan.checkoutKind === "stripe"
              ? () => handleUpgrade(dbPlan.id)
              : displayPlan.checkoutKind === "free"
                ? () => undefined
                : undefined;

          return (
            <PricingPlanCard
              key={displayPlan.family}
              plan={persistedPlan ?? displayPlan}
              current={current}
              pending={pending}
              disabled={checkoutDisabled || displayPlan.checkoutKind === "free"}
              ctaLabel={ctaLabel}
              onAction={onAction}
              testId={`pricing-card-${displayPlan.family}`}
            />
          );
        })}
      </div>
      {error ? (
        <p
          className="text-[13px] text-amber"
          role="alert"
          data-testid="pricing-grid-error"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
