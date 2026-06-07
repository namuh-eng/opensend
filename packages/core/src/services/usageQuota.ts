import { and, eq, sql } from "drizzle-orm";
import { db } from "../db/client";
import { plans, subscriptions, usagePeriods } from "../db/schema";
import { FREE_PLAN_DEFAULTS, FREE_PLAN_SLUG } from "../dto";

type BillingDb = Pick<typeof db, "insert" | "query" | "update">;

const PAST_DUE_GRACE_MS = 3 * 24 * 60 * 60 * 1000;
const ACTIVE_STATUSES = new Set(["active", "trialing", "past_due"]);

export type UsageQuotaResult =
  | { ok: true; bypassed: boolean }
  | {
      ok: false;
      info: {
        resource: "emails";
        plan: string;
        limit: number;
        used: number;
      };
    };

function startOfMonthUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function startOfNextMonthUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
}

function billingEnabled(env: Record<string, string | undefined>): boolean {
  return (
    env.BILLING_BACKEND?.trim().toLowerCase() === "stripe" &&
    Boolean(env.STRIPE_SECRET_KEY?.trim())
  );
}

async function ensureFreePlan(database: BillingDb) {
  const [created] = await database
    .insert(plans)
    .values({
      slug: FREE_PLAN_DEFAULTS.slug,
      name: FREE_PLAN_DEFAULTS.name,
      monthlyPriceCents: FREE_PLAN_DEFAULTS.monthlyPriceCents,
      monthlyEmailQuota: FREE_PLAN_DEFAULTS.monthlyEmailQuota,
      dailyEmailQuota: FREE_PLAN_DEFAULTS.dailyEmailQuota,
      maxDomains: FREE_PLAN_DEFAULTS.maxDomains,
      maxApiKeys: FREE_PLAN_DEFAULTS.maxApiKeys,
      maxContacts: FREE_PLAN_DEFAULTS.maxContacts,
      maxSegments: FREE_PLAN_DEFAULTS.maxSegments,
      maxBroadcasts: FREE_PLAN_DEFAULTS.maxBroadcasts,
      ratePerSecond: FREE_PLAN_DEFAULTS.ratePerSecond,
      isPublic: FREE_PLAN_DEFAULTS.isPublic,
    })
    .onConflictDoNothing({ target: plans.slug })
    .returning();
  if (created) return created;

  const existing = await database.query.plans.findFirst({
    where: eq(plans.slug, FREE_PLAN_SLUG),
  });
  if (!existing) {
    throw new Error("Free plan ensure failed: insert ignored but no row");
  }
  return existing;
}

async function loadPlanContext(userId: string, now: Date, database: BillingDb) {
  const sub = await database.query.subscriptions.findFirst({
    where: eq(subscriptions.userId, userId),
  });

  if (sub && ACTIVE_STATUSES.has(sub.status)) {
    if (sub.status === "past_due") {
      const periodEnd = sub.currentPeriodEnd;
      if (
        !periodEnd ||
        now.getTime() - periodEnd.getTime() > PAST_DUE_GRACE_MS
      ) {
        return "blocked" as const;
      }
    }

    const plan = await database.query.plans.findFirst({
      where: eq(plans.id, sub.planId),
    });
    if (plan) {
      return {
        plan,
        periodStart: sub.currentPeriodStart ?? startOfMonthUtc(now),
        periodEnd: sub.currentPeriodEnd ?? startOfNextMonthUtc(now),
      };
    }
  }

  const plan = await ensureFreePlan(database);
  return {
    plan,
    periodStart: startOfMonthUtc(now),
    periodEnd: startOfNextMonthUtc(now),
  };
}

async function ensureUsagePeriod(input: {
  userId: string;
  periodStart: Date;
  periodEnd: Date;
  database: BillingDb;
}) {
  const existing = await input.database.query.usagePeriods.findFirst({
    where: and(
      eq(usagePeriods.userId, input.userId),
      eq(usagePeriods.periodStart, input.periodStart),
    ),
  });
  if (existing) return existing;

  const [created] = await input.database
    .insert(usagePeriods)
    .values({
      userId: input.userId,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      emailsSent: 0,
    })
    .onConflictDoNothing({
      target: [usagePeriods.userId, usagePeriods.periodStart],
    })
    .returning();
  if (created) return created;

  const reread = await input.database.query.usagePeriods.findFirst({
    where: and(
      eq(usagePeriods.userId, input.userId),
      eq(usagePeriods.periodStart, input.periodStart),
    ),
  });
  if (!reread) throw new Error("Failed to ensure usage_periods row");
  return reread;
}

export async function reserveTransactionalEmailQuota(
  userId: string | null | undefined,
  delta: number,
  now: Date = new Date(),
  env: Record<string, string | undefined> = process.env,
  database: BillingDb = db,
): Promise<UsageQuotaResult> {
  if (delta <= 0 || !userId || !billingEnabled(env)) {
    return { ok: true, bypassed: true };
  }

  const ctx = await loadPlanContext(userId, now, database);
  if (ctx === "blocked") {
    return {
      ok: false,
      info: { resource: "emails", plan: "past_due", limit: 0, used: 0 },
    };
  }

  await ensureUsagePeriod({
    userId,
    periodStart: ctx.periodStart,
    periodEnd: ctx.periodEnd,
    database,
  });

  const updated = await database
    .update(usagePeriods)
    .set({
      emailsSent: sql`${usagePeriods.emailsSent} + ${delta}`,
      lastIncrementAt: now,
    })
    .where(
      and(
        eq(usagePeriods.userId, userId),
        eq(usagePeriods.periodStart, ctx.periodStart),
        sql`${usagePeriods.emailsSent} + ${delta} <= ${ctx.plan.monthlyEmailQuota}`,
      ),
    )
    .returning({ emailsSent: usagePeriods.emailsSent });

  if (updated.length > 0) return { ok: true, bypassed: false };

  const current = await database.query.usagePeriods.findFirst({
    where: and(
      eq(usagePeriods.userId, userId),
      eq(usagePeriods.periodStart, ctx.periodStart),
    ),
  });

  return {
    ok: false,
    info: {
      resource: "emails",
      plan: ctx.plan.slug,
      limit: ctx.plan.monthlyEmailQuota,
      used: current?.emailsSent ?? 0,
    },
  };
}

export async function releaseTransactionalEmailQuota(
  userId: string | null | undefined,
  delta: number,
  now: Date = new Date(),
  env: Record<string, string | undefined> = process.env,
  database: BillingDb = db,
): Promise<void> {
  if (delta <= 0 || !userId || !billingEnabled(env)) return;

  try {
    const ctx = await loadPlanContext(userId, now, database);
    if (ctx === "blocked") return;
    await database
      .update(usagePeriods)
      .set({
        emailsSent: sql`GREATEST(${usagePeriods.emailsSent} - ${delta}, 0)`,
      })
      .where(
        and(
          eq(usagePeriods.userId, userId),
          eq(usagePeriods.periodStart, ctx.periodStart),
        ),
      );
  } catch {
    // Best-effort compensation only.
  }
}
