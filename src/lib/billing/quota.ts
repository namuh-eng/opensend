import { publicApiErrorResponse } from "@/lib/api-errors";
import { db } from "@/lib/db";
import {
  apiKeys,
  domains,
  plans,
  subscriptions,
  usagePeriods,
} from "@/lib/db/schema";
import { FREE_PLAN_SLUG } from "@opensend/core";
import { and, count, eq, sql } from "drizzle-orm";
import { getBillingBackend } from "./index";

type BillingDb = Pick<typeof db, "insert" | "query" | "select" | "update">;

const PAST_DUE_GRACE_MS = 3 * 24 * 60 * 60 * 1000;
const UPGRADE_URL = "/dashboard/billing";

const ACTIVE_STATUSES = new Set(["active", "trialing", "past_due"]);

export type QuotaResource = "emails" | "domains" | "api_keys";

export interface QuotaExceededInfo {
  resource: QuotaResource;
  plan: string;
  limit: number;
  used: number;
  upgrade_url: string;
}

export type QuotaResult =
  | { ok: true; bypassed: boolean }
  | { ok: false; info: QuotaExceededInfo };

interface PlanLike {
  slug: string;
  monthlyEmailQuota: number;
  maxDomains: number;
  maxApiKeys: number;
}

interface PlanContext {
  plan: PlanLike;
  periodStart: Date;
  periodEnd: Date;
}

function startOfMonthUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function startOfNextMonthUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
}

function isBillingDisabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return getBillingBackend(env) === "disabled";
}

function blockedInfo(
  resource: QuotaResource,
  plan = "past_due",
): QuotaExceededInfo {
  return {
    resource,
    plan,
    limit: 0,
    used: 0,
    upgrade_url: UPGRADE_URL,
  };
}

async function ensureFreePlan(database: BillingDb): Promise<PlanLike> {
  const [created] = await database
    .insert(plans)
    .values({
      slug: FREE_PLAN_SLUG,
      name: "Free",
      monthlyPriceCents: 0,
      monthlyEmailQuota: 3000,
      maxDomains: 1,
      maxApiKeys: 3,
      isPublic: true,
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

async function loadPlanContext(
  userId: string,
  now: Date,
  database: BillingDb,
): Promise<PlanContext | "blocked"> {
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
        return "blocked";
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

  const freePlan = await ensureFreePlan(database);
  return {
    plan: freePlan,
    periodStart: startOfMonthUtc(now),
    periodEnd: startOfNextMonthUtc(now),
  };
}

async function ensureUsagePeriod(
  userId: string,
  periodStart: Date,
  periodEnd: Date,
  database: BillingDb,
): Promise<{ id: string; emailsSent: number }> {
  const existing = await database.query.usagePeriods.findFirst({
    where: and(
      eq(usagePeriods.userId, userId),
      eq(usagePeriods.periodStart, periodStart),
    ),
  });
  if (existing) return existing;

  const [created] = await database
    .insert(usagePeriods)
    .values({ userId, periodStart, periodEnd, emailsSent: 0 })
    .onConflictDoNothing({
      target: [usagePeriods.userId, usagePeriods.periodStart],
    })
    .returning();
  if (created) return created;

  const reread = await database.query.usagePeriods.findFirst({
    where: and(
      eq(usagePeriods.userId, userId),
      eq(usagePeriods.periodStart, periodStart),
    ),
  });
  if (!reread) throw new Error("Failed to ensure usage_periods row");
  return reread;
}

/**
 * Atomically reserve `delta` units of monthly email quota for `userId`.
 *
 * Implementation note: a single SQL `UPDATE ... WHERE emails_sent + delta <= quota`
 * is the source of truth for atomicity. Concurrent workers race on the same row
 * and at most one transaction commits an over-quota state — Postgres row locking
 * prevents the read-then-write window that mutex-style approaches leave open.
 *
 * Pass a Drizzle transaction as `database` when the reservation must commit with
 * the accepted email rows. Test doubles may omit true row locking; the SQL shape
 * is the production concurrency boundary.
 */
export async function reserveEmailQuota(
  userId: string | null | undefined,
  delta: number,
  now: Date = new Date(),
  env: Record<string, string | undefined> = process.env,
  database: BillingDb = db,
): Promise<QuotaResult> {
  if (delta <= 0) return { ok: true, bypassed: true };
  if (isBillingDisabled(env)) return { ok: true, bypassed: true };
  if (!userId) return { ok: true, bypassed: true };

  const ctx = await loadPlanContext(userId, now, database);
  if (ctx === "blocked") {
    return { ok: false, info: blockedInfo("emails") };
  }

  await ensureUsagePeriod(userId, ctx.periodStart, ctx.periodEnd, database);

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

  if (updated.length === 0) {
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
        upgrade_url: UPGRADE_URL,
      },
    };
  }

  return { ok: true, bypassed: false };
}

/**
 * Best-effort decrement to compensate a previously reserved unit when the
 * downstream accept operation fails after reservation. Never throws.
 */
export async function releaseEmailQuota(
  userId: string | null | undefined,
  delta: number,
  now: Date = new Date(),
  env: Record<string, string | undefined> = process.env,
  database: BillingDb = db,
): Promise<void> {
  if (delta <= 0 || !userId || isBillingDisabled(env)) return;

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
    // best-effort; never throw from release path
  }
}

export async function checkDomainQuota(
  userId: string | null | undefined,
  now: Date = new Date(),
  env: Record<string, string | undefined> = process.env,
  database: BillingDb = db,
): Promise<QuotaResult> {
  if (isBillingDisabled(env)) return { ok: true, bypassed: true };
  if (!userId) return { ok: true, bypassed: true };

  const ctx = await loadPlanContext(userId, now, database);
  if (ctx === "blocked") {
    return { ok: false, info: blockedInfo("domains") };
  }

  const [row] = await database
    .select({ value: count() })
    .from(domains)
    .where(eq(domains.userId, userId));

  const used = Number(row?.value ?? 0);
  if (used >= ctx.plan.maxDomains) {
    return {
      ok: false,
      info: {
        resource: "domains",
        plan: ctx.plan.slug,
        limit: ctx.plan.maxDomains,
        used,
        upgrade_url: UPGRADE_URL,
      },
    };
  }
  return { ok: true, bypassed: false };
}

export async function checkApiKeyQuota(
  userId: string | null | undefined,
  now: Date = new Date(),
  env: Record<string, string | undefined> = process.env,
  database: BillingDb = db,
): Promise<QuotaResult> {
  if (isBillingDisabled(env)) return { ok: true, bypassed: true };
  if (!userId) return { ok: true, bypassed: true };

  const ctx = await loadPlanContext(userId, now, database);
  if (ctx === "blocked") {
    return { ok: false, info: blockedInfo("api_keys") };
  }

  const [row] = await database
    .select({ value: count() })
    .from(apiKeys)
    .where(eq(apiKeys.userId, userId));

  const used = Number(row?.value ?? 0);
  if (used >= ctx.plan.maxApiKeys) {
    return {
      ok: false,
      info: {
        resource: "api_keys",
        plan: ctx.plan.slug,
        limit: ctx.plan.maxApiKeys,
        used,
        upgrade_url: UPGRADE_URL,
      },
    };
  }
  return { ok: true, bypassed: false };
}

export function quotaExceededResponse(
  info: QuotaExceededInfo,
  init?: ResponseInit,
): Response {
  return publicApiErrorResponse("quota_exceeded", "Quota exceeded.", 402, {
    ...init,
    details: {
      resource: info.resource,
      limit: info.limit,
      used: info.used,
      plan: info.plan,
      upgrade_url: info.upgrade_url,
    },
  });
}
