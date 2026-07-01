"use client";

import { useState } from "react";

interface PlanInfo {
  name: string;
  slug: string;
  monthlyPriceCents: number;
}

interface SubscriptionInfo {
  status: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

interface CurrentPlanCardProps {
  plan: PlanInfo;
  subscription: SubscriptionInfo | null;
}

function formatPrice(cents: number) {
  if (cents === 0) return "Free";
  return `$${(cents / 100).toFixed(0)} / mo`;
}

function formatStatus(status: string) {
  return status.replace(/_/g, " ");
}

function formatPeriodEnd(value: string | null) {
  if (!value) return null;
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(value));
  } catch {
    return null;
  }
}

export function CurrentPlanCard({ plan, subscription }: CurrentPlanCardProps) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const periodEnd = formatPeriodEnd(subscription?.currentPeriodEnd ?? null);

  const handleManage = async () => {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/billing/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
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
          : "Manage Billing is unavailable.";
      setError(message);
      setPending(false);
    } catch {
      setError("Manage Billing is unavailable.");
      setPending(false);
    }
  };

  return (
    <div
      className="rounded-lg border border-line bg-bg-3 p-6"
      data-testid="billing-current-plan-card"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[16px] font-semibold text-fg">Current plan</h2>
          <div className="mt-2 flex items-baseline gap-3">
            <span
              className="text-[22px] font-semibold text-fg"
              data-testid="current-plan-name"
            >
              {plan.name}
            </span>
            <span className="text-[14px] text-fg-2">
              {formatPrice(plan.monthlyPriceCents)}
            </span>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px]">
            <span
              className="rounded-full border border-line px-2 py-0.5 capitalize text-fg-2"
              data-testid="current-plan-status"
            >
              {subscription
                ? formatStatus(subscription.status)
                : "No active plan"}
            </span>
            {subscription?.cancelAtPeriodEnd ? (
              <span
                className="rounded-full bg-amber/15 px-2 py-0.5 text-amber"
                data-testid="cancel-at-period-end-badge"
              >
                Cancels at period end
              </span>
            ) : null}
            {periodEnd ? (
              <span className="text-fg-2" data-testid="current-period-end">
                Renews {periodEnd}
              </span>
            ) : null}
          </div>
        </div>
        <button
          type="button"
          onClick={handleManage}
          disabled={pending}
          className="rounded-md border border-line bg-bg-3 px-3 py-1.5 text-[13px] font-medium text-fg transition-colors hover:bg-bg-card disabled:cursor-not-allowed disabled:opacity-50"
          data-testid="manage-billing-button"
        >
          {pending ? "Opening…" : "Manage Billing"}
        </button>
      </div>
      {error ? (
        <p className="mt-4 text-[12px] text-amber" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
