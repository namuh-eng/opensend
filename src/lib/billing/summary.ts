import { db } from "@/lib/db";
import {
  apiKeys,
  domains,
  plans,
  subscriptions,
  usagePeriods,
} from "@/lib/db/schema";
import {
  type DashboardUsagePayload,
  FREE_PLAN_SLUG,
  type SubscriptionStatus,
  createDashboardAggregateService,
} from "@opensend/core";
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

export interface PublicPlanResponse {
  object: "plan";
  id: string;
  slug: string;
  name: string;
  monthly_price_cents: number;
  monthly_email_quota: number;
  max_domains: number;
  max_api_keys: number;
}

export interface BillingPlansResponse {
  object: "list";
  data: PublicPlanResponse[];
}

export interface BillingSummaryPlanResponse {
  id: string;
  slug: string;
  name: string;
  monthly_price_cents: number;
  monthly_email_quota: number;
  max_domains: number;
  max_api_keys: number;
}

export interface BillingSummaryResponse {
  object: "billing_summary";
  plan: BillingSummaryPlanResponse;
  subscription: {
    id: string;
    status: SubscriptionStatus;
    current_period_start: string | null;
    current_period_end: string | null;
    cancel_at_period_end: boolean;
  } | null;
  usage: {
    emails: BillingUsageSummary["emails"];
    domains: BillingUsageSummary["domains"];
    api_keys: BillingUsageSummary["apiKeys"];
    period_start: string | null;
    period_end: string | null;
    has_usage_period: boolean;
  };
}

export interface BillingUsageInput {
  billingEnabled: boolean;
  userId?: string | null;
}

export interface DashboardUsageService {
  getUsage(): Promise<DashboardUsagePayload>;
}

export interface BillingSummaryServiceDeps {
  listPlans?: () => Promise<BillingPlanSummary[]>;
  loadSummary?: (userId: string) => Promise<BillingSummary | null>;
  dashboardUsage?: DashboardUsageService | (() => DashboardUsageService);
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

function toPublicPlanResponse(plan: BillingPlanSummary): PublicPlanResponse {
  return {
    object: "plan",
    ...toBillingSummaryPlanResponse(plan),
  };
}

function toBillingSummaryPlanResponse(
  plan: BillingPlanSummary,
): BillingSummaryPlanResponse {
  return {
    id: plan.id,
    slug: plan.slug,
    name: plan.name,
    monthly_price_cents: plan.monthlyPriceCents,
    monthly_email_quota: plan.monthlyEmailQuota,
    max_domains: plan.maxDomains,
    max_api_keys: plan.maxApiKeys,
  };
}

function toBillingSummaryResponse(
  summary: BillingSummary,
): BillingSummaryResponse {
  return {
    object: "billing_summary",
    plan: toBillingSummaryPlanResponse(summary.plan),
    subscription: summary.subscription
      ? {
          id: summary.subscription.id,
          status: summary.subscription.status,
          current_period_start: summary.subscription.currentPeriodStart,
          current_period_end: summary.subscription.currentPeriodEnd,
          cancel_at_period_end: summary.subscription.cancelAtPeriodEnd,
        }
      : null,
    usage: {
      emails: summary.usage.emails,
      domains: summary.usage.domains,
      api_keys: summary.usage.apiKeys,
      period_start: summary.usage.periodStart,
      period_end: summary.usage.periodEnd,
      has_usage_period: summary.usage.hasUsagePeriod,
    },
  };
}

let defaultDashboardUsageService: DashboardUsageService | null = null;

function getDefaultDashboardUsageService(): DashboardUsageService {
  defaultDashboardUsageService ??= createDashboardAggregateService();
  return defaultDashboardUsageService;
}

export function createBillingSummaryService({
  listPlans = listPublicPlans,
  loadSummary = loadBillingSummary,
  dashboardUsage = getDefaultDashboardUsageService,
}: BillingSummaryServiceDeps = {}) {
  function getDashboardUsageService() {
    return typeof dashboardUsage === "function"
      ? dashboardUsage()
      : dashboardUsage;
  }

  return {
    async listPlans(): Promise<BillingPlansResponse> {
      return {
        object: "list",
        data: (await listPlans()).map(toPublicPlanResponse),
      };
    },

    async getBillingSummary(
      userId: string,
    ): Promise<BillingSummaryResponse | null> {
      const summary = await loadSummary(userId);
      return summary ? toBillingSummaryResponse(summary) : null;
    },

    async getUsage({
      billingEnabled,
      userId,
    }: BillingUsageInput): Promise<DashboardUsagePayload> {
      const payload = await getDashboardUsageService().getUsage();

      if (!billingEnabled || !userId) return payload;

      const billingSummary = await loadSummary(userId);
      if (!billingSummary) return payload;

      return {
        ...payload,
        plan: {
          name: billingSummary.plan.name,
          slug: billingSummary.plan.slug,
        },
        transactional: {
          ...payload.transactional,
          monthlyLimit: billingSummary.plan.monthlyEmailQuota,
        },
        team: {
          ...payload.team,
          domainsUsed: billingSummary.usage.domains.used,
          domainsLimit: billingSummary.usage.domains.limit,
        },
      };
    },
  };
}

export function createDefaultBillingSummaryService() {
  return createBillingSummaryService();
}
