import { db } from "@/lib/db";
import {
  apiKeys,
  domains,
  plans,
  subscriptions,
  usagePeriods,
} from "@/lib/db/schema";
import { FREE_PLAN_SLUG, type SubscriptionStatus } from "@opensend/core";
import { count, desc, eq } from "drizzle-orm";

export interface BillingPlanSummary {
  id: string;
  slug: string;
  name: string;
  monthlyPriceCents: number;
  monthlyEmailQuota: number;
  maxDomains: number;
  maxApiKeys: number;
  isPublic: boolean;
}

export interface BillingSubscriptionSummary {
  id: string;
  status: SubscriptionStatus;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

export interface BillingUsageSummary {
  emails: { used: number | null; limit: number };
  domains: { used: number; limit: number };
  apiKeys: { used: number; limit: number };
  periodStart: string | null;
  periodEnd: string | null;
  hasUsagePeriod: boolean;
}

export interface BillingSummary {
  plan: BillingPlanSummary;
  subscription: BillingSubscriptionSummary | null;
  usage: BillingUsageSummary;
}

function toIso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

function toPlanSummary(row: {
  id: string;
  slug: string;
  name: string;
  monthlyPriceCents: number;
  monthlyEmailQuota: number;
  maxDomains: number;
  maxApiKeys: number;
  isPublic: boolean;
}): BillingPlanSummary {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    monthlyPriceCents: row.monthlyPriceCents,
    monthlyEmailQuota: row.monthlyEmailQuota,
    maxDomains: row.maxDomains,
    maxApiKeys: row.maxApiKeys,
    isPublic: row.isPublic,
  };
}

async function loadPlanAndSubscription(userId: string) {
  const sub = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.userId, userId),
  });

  if (sub) {
    const plan = await db.query.plans.findFirst({
      where: eq(plans.id, sub.planId),
    });
    if (plan) return { plan, subscription: sub };
  }

  const free = await db.query.plans.findFirst({
    where: eq(plans.slug, FREE_PLAN_SLUG),
  });
  return { plan: free, subscription: null };
}

async function loadLatestUsagePeriod(userId: string) {
  const [latest] = await db
    .select()
    .from(usagePeriods)
    .where(eq(usagePeriods.userId, userId))
    .orderBy(desc(usagePeriods.periodStart))
    .limit(1);
  return latest ?? null;
}

async function countUserDomains(userId: string) {
  const [row] = await db
    .select({ value: count() })
    .from(domains)
    .where(eq(domains.userId, userId));
  return Number(row?.value ?? 0);
}

async function countUserApiKeys(userId: string) {
  const [row] = await db
    .select({ value: count() })
    .from(apiKeys)
    .where(eq(apiKeys.userId, userId));
  return Number(row?.value ?? 0);
}

export async function loadBillingSummary(
  userId: string,
): Promise<BillingSummary | null> {
  const { plan, subscription } = await loadPlanAndSubscription(userId);
  if (!plan) return null;

  const usagePeriod = await loadLatestUsagePeriod(userId);

  const [domainCount, apiKeyCount] = await Promise.all([
    countUserDomains(userId),
    countUserApiKeys(userId),
  ]);

  const planSummary = toPlanSummary(plan);
  const subscriptionSummary: BillingSubscriptionSummary | null = subscription
    ? {
        id: subscription.id,
        status: subscription.status as SubscriptionStatus,
        currentPeriodStart: toIso(subscription.currentPeriodStart),
        currentPeriodEnd: toIso(subscription.currentPeriodEnd),
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      }
    : null;

  const usage: BillingUsageSummary = {
    emails: {
      used: usagePeriod ? usagePeriod.emailsSent : null,
      limit: planSummary.monthlyEmailQuota,
    },
    domains: { used: domainCount, limit: planSummary.maxDomains },
    apiKeys: { used: apiKeyCount, limit: planSummary.maxApiKeys },
    periodStart: toIso(usagePeriod?.periodStart ?? null),
    periodEnd: toIso(usagePeriod?.periodEnd ?? null),
    hasUsagePeriod: usagePeriod !== null,
  };

  return { plan: planSummary, subscription: subscriptionSummary, usage };
}

export async function listPublicPlans(): Promise<BillingPlanSummary[]> {
  const rows = await db.select().from(plans).where(eq(plans.isPublic, true));
  return rows
    .map(toPlanSummary)
    .sort((a, b) => a.monthlyPriceCents - b.monthlyPriceCents);
}
