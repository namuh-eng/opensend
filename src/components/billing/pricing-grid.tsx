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

type PlanCopy = {
  kicker: string;
  blurb: string;
  perks: string[];
};

const PLAN_COPY: Record<string, PlanCopy> = {
  free: {
    kicker: "Free",
    blurb: "For tinkering and side projects.",
    perks: [
      "Resend-compatible REST API",
      "TypeScript SDK + React Email",
      "HMAC-signed webhooks",
      "Open/click analytics",
      "Community support",
    ],
  },
  starter: {
    kicker: "Starter",
    blurb: "For small teams shipping production email.",
    perks: [
      "Everything in Free",
      "API sends + broadcast fanout",
      "Contacts, segments, and broadcasts",
      "Email automations",
      "Email support · 48h",
    ],
  },
  growth: {
    kicker: "Growth",
    blurb: "For domain-heavy teams growing broadcast and API volume.",
    perks: [
      "Everything in Starter",
      "Advanced broadcast and audience workflows",
      "Custom Return-Path domains",
      "Audit log & SSO (Google)",
      "Priority support · 12h",
    ],
  },
  scale: {
    kicker: "Scale",
    blurb: "High-volume, regulated, custom needs.",
    perks: [
      "Everything in Growth",
      "BYO AWS account",
      "Dedicated infra & VPC peering",
      "BAA / SOC 2 assistance",
      "Slack channel · 1h SLA",
    ],
  },
};

function getPlanCopy(plan: PricingPlan): PlanCopy {
  return (
    PLAN_COPY[plan.slug] ?? {
      kicker: plan.name,
      blurb: "For teams growing their sending volume.",
      perks: [
        "Transactional email sending",
        "Dashboard usage visibility",
        "API keys and domain management",
        "API sends + broadcast fanout",
      ],
    }
  );
}

function formatPrice(cents: number) {
  if (cents === 0) return "Free";
  return `$${(cents / 100).toFixed(0)}`;
}

function formatNumber(n: number) {
  return n.toLocaleString("en-US");
}

function ctaLabel(plan: PricingPlan, isCurrent: boolean, isPending: boolean) {
  if (isCurrent) return "Current plan";
  if (isPending) return "Opening checkout…";
  if (plan.monthlyPriceCents === 0) return "Change to Free";
  return `Change to ${formatPrice(plan.monthlyPriceCents)} / mo`;
}

function isFeaturedPlan(plan: PricingPlan) {
  return plan.slug === "growth";
}

export function PricingGrid({ plans, currentPlanId }: PricingGridProps) {
  const [pendingPlanId, setPendingPlanId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (plans.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[rgba(176,199,217,0.145)] bg-[rgba(24,25,28,0.45)] p-12 text-center text-[14px] text-[#A1A4A5]">
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
      <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-4">
        {plans.map((plan) => {
          const isCurrent = plan.id === currentPlanId;
          const isPending = pendingPlanId === plan.id;
          const copy = getPlanCopy(plan);
          const featured = isFeaturedPlan(plan);
          return (
            <article
              key={plan.id}
              className={`relative flex min-h-[560px] flex-col overflow-visible rounded-[18px] border p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] ${
                featured
                  ? "border-[#C9FF66]/70 bg-[radial-gradient(circle_at_50%_0%,rgba(201,255,102,0.14),rgba(15,17,15,0.82)_34%,rgba(12,13,15,0.86)_100%)]"
                  : isCurrent
                    ? "border-purple-500/60 bg-[radial-gradient(circle_at_50%_0%,rgba(126,65,255,0.16),rgba(13,10,18,0.84)_40%,rgba(12,13,15,0.86)_100%)]"
                    : "border-[rgba(176,199,217,0.145)] bg-[linear-gradient(180deg,rgba(24,25,28,0.7),rgba(12,13,15,0.86))]"
              }`}
              data-testid={`pricing-card-${plan.slug}`}
              data-current={isCurrent ? "true" : undefined}
            >
              {featured ? (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#C9FF66] px-4 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-[#08090A] shadow-[0_0_24px_rgba(201,255,102,0.45)]">
                  Most popular
                </div>
              ) : null}

              <header className="mb-5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <p
                    className={`font-mono text-[11px] font-semibold uppercase tracking-[0.22em] ${
                      featured ? "text-[#C9FF66]" : "text-[#777D80]"
                    }`}
                  >
                    {copy.kicker}
                  </p>
                  {isCurrent ? (
                    <span
                      className="rounded-full bg-purple-500/20 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-purple-200"
                      data-testid={`pricing-card-${plan.slug}-current-badge`}
                    >
                      Current
                    </span>
                  ) : null}
                </div>
                <div>
                  <h3 className="text-[22px] font-semibold tracking-[-0.02em] text-[#F0F0F0]">
                    {plan.name}
                  </h3>
                  <p className="mt-2 min-h-[40px] text-[14px] leading-5 text-[#A1A4A5]">
                    {copy.blurb}
                  </p>
                </div>
              </header>

              <div className="mb-5 flex items-end gap-2">
                {plan.monthlyPriceCents === 0 ? (
                  <>
                    <span className="text-[13px] text-[#777D80]">$</span>
                    <span className="text-5xl font-semibold tracking-[-0.06em] text-[#F0F0F0]">
                      0
                    </span>
                    <span className="pb-1 text-[13px] text-[#777D80]">/mo</span>
                  </>
                ) : (
                  <>
                    <span className="text-[13px] text-[#777D80]">$</span>
                    <span className="text-5xl font-semibold tracking-[-0.06em] text-[#F0F0F0]">
                      {(plan.monthlyPriceCents / 100).toFixed(0)}
                    </span>
                    <span className="pb-1 text-[13px] text-[#777D80]">/mo</span>
                  </>
                )}
              </div>

              <dl className="mb-6 overflow-hidden rounded-xl border border-[rgba(176,199,217,0.09)] bg-[rgba(8,9,10,0.35)] text-[13px]">
                <div className="grid grid-cols-[88px_1fr] border-b border-[rgba(176,199,217,0.09)]">
                  <dt className="px-3 py-2 font-mono text-[#777D80]">quota</dt>
                  <dd
                    className={`px-3 py-2 text-right font-mono ${
                      featured ? "text-[#C9FF66]" : "text-[#F0F0F0]"
                    }`}
                  >
                    {formatNumber(plan.monthlyEmailQuota)} API + broadcast
                    emails/mo
                  </dd>
                </div>
                <div className="grid grid-cols-[88px_1fr] border-b border-[rgba(176,199,217,0.09)]">
                  <dt className="px-3 py-2 font-mono text-[#777D80]">
                    domains
                  </dt>
                  <dd className="px-3 py-2 text-right font-mono text-[#F0F0F0]">
                    {formatNumber(plan.maxDomains)} verified{" "}
                    {plan.maxDomains === 1 ? "domain" : "domains"}
                  </dd>
                </div>
                <div className="grid grid-cols-[88px_1fr]">
                  <dt className="px-3 py-2 font-mono text-[#777D80]">keys</dt>
                  <dd className="px-3 py-2 text-right font-mono text-[#F0F0F0]">
                    {formatNumber(plan.maxApiKeys)} API{" "}
                    {plan.maxApiKeys === 1 ? "key" : "keys"}
                  </dd>
                </div>
              </dl>

              <ul className="mb-8 flex-1 space-y-3 text-[14px] text-[#A1A4A5]">
                {copy.perks.map((perk) => (
                  <li className="flex gap-3" key={perk}>
                    <span
                      className={`mt-0.5 ${
                        featured ? "text-[#C9FF66]" : "text-[#F0F0F0]"
                      }`}
                    >
                      ✓
                    </span>
                    <span>{perk}</span>
                  </li>
                ))}
              </ul>

              <button
                type="button"
                disabled={isCurrent || isPending}
                onClick={() => handleUpgrade(plan.id)}
                className={`mt-auto rounded-lg px-3 py-3 text-[14px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-55 ${
                  featured
                    ? "bg-[#C9FF66] text-[#08090A] hover:bg-[#D6FF84]"
                    : "border border-[rgba(176,199,217,0.145)] bg-[rgba(24,25,28,0.88)] text-[#F0F0F0] hover:bg-[rgba(24,25,28,1)]"
                }`}
                data-testid={`pricing-card-${plan.slug}-upgrade`}
              >
                {ctaLabel(plan, isCurrent, isPending)}
              </button>
            </article>
          );
        })}
      </div>
      {error ? (
        <p
          className="text-center text-[13px] text-amber-300"
          role="alert"
          data-testid="pricing-grid-error"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
