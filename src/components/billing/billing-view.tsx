"use client";

import { CurrentPlanCard } from "@/components/billing/current-plan-card";
import { UsageCard } from "@/components/billing/usage-card";
import Link from "next/link";
import { useEffect, useState } from "react";

export interface BillingViewSummary {
  plan: {
    id: string;
    slug: string;
    name: string;
    monthlyPriceCents: number;
    monthlyEmailQuota: number;
    maxDomains: number;
    maxApiKeys: number;
  };
  subscription: {
    id: string;
    status: string;
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
  } | null;
  usage: {
    emails: { used: number | null; limit: number };
    domains: { used: number; limit: number };
    apiKeys: { used: number; limit: number };
    periodStart: string | null;
    periodEnd: string | null;
    hasUsagePeriod: boolean;
  };
}

interface SummaryEnvelope {
  plan: {
    id: string;
    slug: string;
    name: string;
    monthly_price_cents: number;
    monthly_email_quota: number;
    max_domains: number;
    max_api_keys: number;
  };
  subscription: {
    id: string;
    status: string;
    current_period_start: string | null;
    current_period_end: string | null;
    cancel_at_period_end: boolean;
  } | null;
  usage: {
    emails: { used: number | null; limit: number };
    domains: { used: number; limit: number };
    api_keys: { used: number; limit: number };
    period_start: string | null;
    period_end: string | null;
    has_usage_period: boolean;
  };
}

function isSummaryEnvelope(value: unknown): value is SummaryEnvelope {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.plan === "object" &&
    v.plan !== null &&
    typeof v.usage === "object" &&
    v.usage !== null
  );
}

function adaptEnvelope(envelope: SummaryEnvelope): BillingViewSummary {
  return {
    plan: {
      id: envelope.plan.id,
      slug: envelope.plan.slug,
      name: envelope.plan.name,
      monthlyPriceCents: envelope.plan.monthly_price_cents,
      monthlyEmailQuota: envelope.plan.monthly_email_quota,
      maxDomains: envelope.plan.max_domains,
      maxApiKeys: envelope.plan.max_api_keys,
    },
    subscription: envelope.subscription
      ? {
          id: envelope.subscription.id,
          status: envelope.subscription.status,
          currentPeriodStart: envelope.subscription.current_period_start,
          currentPeriodEnd: envelope.subscription.current_period_end,
          cancelAtPeriodEnd: envelope.subscription.cancel_at_period_end,
        }
      : null,
    usage: {
      emails: envelope.usage.emails,
      domains: envelope.usage.domains,
      apiKeys: envelope.usage.api_keys,
      periodStart: envelope.usage.period_start,
      periodEnd: envelope.usage.period_end,
      hasUsagePeriod: envelope.usage.has_usage_period,
    },
  };
}

interface BillingViewProps {
  initial: BillingViewSummary;
}

export function BillingView({ initial }: BillingViewProps) {
  const [summary, setSummary] = useState<BillingViewSummary>(initial);

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      try {
        const response = await fetch("/api/billing/summary", {
          credentials: "same-origin",
        });
        if (!response.ok) return;
        const data: unknown = await response.json();
        if (!cancelled && isSummaryEnvelope(data)) {
          setSummary(adaptEnvelope(data));
        }
      } catch {
        // best-effort refetch; keep server-rendered state
      }
    }

    function onFocus() {
      void refresh();
    }

    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  return (
    <div className="space-y-6" data-testid="billing-view">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-fg">Billing</h1>
          <p className="mt-1 text-[13px] text-fg-2">
            Review your current plan, usage, and billing details.
          </p>
        </div>
        <Link
          href="/settings/billing/plans"
          className="rounded-md border border-line bg-bg-3 px-3 py-1.5 text-[13px] font-medium text-fg transition-colors hover:bg-bg-card"
          data-testid="view-plans-link"
        >
          View plans
        </Link>
      </div>

      <CurrentPlanCard
        plan={summary.plan}
        subscription={summary.subscription}
      />

      <UsageCard
        data={{
          emails: summary.usage.emails,
          domains: summary.usage.domains,
          apiKeys: summary.usage.apiKeys,
          periodStart: summary.usage.periodStart,
          periodEnd: summary.usage.periodEnd,
          hasUsagePeriod: summary.usage.hasUsagePeriod,
        }}
      />
    </div>
  );
}
