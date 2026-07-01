// ABOUTME: Single source of truth for hosted billing entitlement. Every billable
// surface (quota, broadcast fanout, dedicated IP, display) resolves access here.
// Self-host (billing disabled) is always granted; hosted requires an active PAID
// subscription. A legacy free/zero-price plan is NOT a paid plan.
import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { plans, subscriptions } from "../db/schema";

type PlanRow = typeof plans.$inferSelect;
type BillingDb = Pick<typeof db, "query" | "insert" | "update" | "select">;

export const PAST_DUE_GRACE_MS = 3 * 24 * 60 * 60 * 1000;
export const ACTIVE_STATUSES = new Set(["active", "trialing", "past_due"]);

export function startOfMonthUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

export function startOfNextMonthUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
}

/**
 * Hosted billing is enabled only when a Stripe backend and secret key are
 * configured. Any other configuration (including self-host) is "disabled" and
 * bypasses all paywall enforcement.
 */
export function isBillingEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return (
    env.BILLING_BACKEND?.trim().toLowerCase() === "stripe" &&
    Boolean(env.STRIPE_SECRET_KEY?.trim())
  );
}

/** A plan counts as paid only if it is not the legacy free slug and costs > 0. */
export function isPaidPlan(
  plan: Pick<PlanRow, "slug" | "monthlyPriceCents">,
): boolean {
  return plan.slug !== "free" && plan.monthlyPriceCents > 0;
}

export type EntitlementBlockReason =
  | "no_subscription"
  | "past_due"
  | "legacy_free"
  | "missing_plan";

export type BillingEntitlement =
  | { mode: "self_host" }
  | { mode: "active"; plan: PlanRow; periodStart: Date; periodEnd: Date }
  | { mode: "blocked"; reason: EntitlementBlockReason };

/**
 * Resolve a user's billing entitlement. This is the ONLY place that decides
 * whether a hosted user may perform billable actions.
 *
 * Order (fail open on self-host, fail closed on hosted paywall):
 * 1. billing disabled -> self_host (grant everything)
 * 2. no active subscription -> blocked:no_subscription
 * 3. past_due beyond grace -> blocked:past_due
 * 4. subscription plan missing -> blocked:missing_plan
 * 5. resolved plan is free/zero-price -> blocked:legacy_free
 * 6. otherwise -> active (with the subscription's billing period metadata)
 */
export async function resolveBillingEntitlement(
  userId: string,
  now: Date = new Date(),
  env: Record<string, string | undefined> = process.env,
  database: BillingDb = db,
): Promise<BillingEntitlement> {
  if (!isBillingEnabled(env)) return { mode: "self_host" };

  const sub = await database.query.subscriptions.findFirst({
    where: eq(subscriptions.userId, userId),
  });
  if (!sub || !ACTIVE_STATUSES.has(sub.status)) {
    return { mode: "blocked", reason: "no_subscription" };
  }

  if (sub.status === "past_due") {
    const periodEnd = sub.currentPeriodEnd;
    if (!periodEnd || now.getTime() - periodEnd.getTime() > PAST_DUE_GRACE_MS) {
      return { mode: "blocked", reason: "past_due" };
    }
  }

  const plan = await database.query.plans.findFirst({
    where: eq(plans.id, sub.planId),
  });
  if (!plan) return { mode: "blocked", reason: "missing_plan" };
  if (!isPaidPlan(plan)) return { mode: "blocked", reason: "legacy_free" };

  return {
    mode: "active",
    plan,
    periodStart: sub.currentPeriodStart ?? startOfMonthUtc(now),
    periodEnd: sub.currentPeriodEnd ?? startOfNextMonthUtc(now),
  };
}
