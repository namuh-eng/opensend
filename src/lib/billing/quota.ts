import { publicApiErrorResponse } from "@/lib/api-errors";
import { db } from "@/lib/db";
import { apiKeys, domains, usagePeriods } from "@/lib/db/schema";
import { resolveBillingEntitlement } from "@opensend/core";
import { and, count, eq, sql } from "drizzle-orm";

type BillingDb = Pick<typeof db, "insert" | "query" | "select" | "update">;

const UPGRADE_URL = "/dashboard/billing";

export type QuotaResource = "emails" | "domains" | "api_keys" | "mutation";

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

function blockedInfo(
  resource: QuotaResource,
  plan = "no_subscription",
): QuotaExceededInfo {
  return {
    resource,
    plan,
    limit: 0,
    used: 0,
    upgrade_url: UPGRADE_URL,
  };
}

async function ensureUsagePeriod(
  userId: string,
  periodStart: Date,
  periodEnd: Date,
  includedEmailQuota: number,
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
    .values({
      userId,
      periodStart,
      periodEnd,
      emailsSent: 0,
      includedEmailQuota,
    })
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
 * Self-host (billing disabled) bypasses. Hosted users without an active paid
 * subscription are blocked (402 upstream). Paid plans increment past the
 * included quota so overage can be reported asynchronously (no hard cap).
 */
export async function reserveEmailQuota(
  userId: string | null | undefined,
  delta: number,
  now: Date = new Date(),
  env: Record<string, string | undefined> = process.env,
  database: BillingDb = db,
): Promise<QuotaResult> {
  if (delta <= 0) return { ok: true, bypassed: true };
  if (!userId) return { ok: true, bypassed: true };

  const entitlement = await resolveBillingEntitlement(
    userId,
    now,
    env,
    database,
  );
  if (entitlement.mode === "self_host") return { ok: true, bypassed: true };
  if (entitlement.mode === "blocked") {
    return { ok: false, info: blockedInfo("emails", entitlement.reason) };
  }

  const { plan, periodStart, periodEnd } = entitlement;
  await ensureUsagePeriod(
    userId,
    periodStart,
    periodEnd,
    plan.monthlyEmailQuota,
    database,
  );

  const limit = plan.monthlyEmailQuota;
  const warn80Threshold = Math.ceil(limit * 0.8);
  const cap100Threshold = limit;

  const updated = await database
    .update(usagePeriods)
    .set({
      emailsSent: sql`${usagePeriods.emailsSent} + ${delta}`,
      includedEmailQuota: sql`COALESCE(${usagePeriods.includedEmailQuota}, ${limit})`,
      usageWarning80NotifiedAt: sql`CASE
        WHEN ${warn80Threshold} > 0
          AND ${usagePeriods.usageWarning80NotifiedAt} IS NULL
          AND ${usagePeriods.emailsSent} < ${warn80Threshold}
          AND ${usagePeriods.emailsSent} + ${delta} >= ${warn80Threshold}
        THEN ${now}
        ELSE ${usagePeriods.usageWarning80NotifiedAt}
      END`,
      usageWarning100NotifiedAt: sql`CASE
        WHEN ${cap100Threshold} > 0
          AND ${usagePeriods.usageWarning100NotifiedAt} IS NULL
          AND ${usagePeriods.emailsSent} < ${cap100Threshold}
          AND ${usagePeriods.emailsSent} + ${delta} >= ${cap100Threshold}
        THEN ${now}
        ELSE ${usagePeriods.usageWarning100NotifiedAt}
      END`,
      lastIncrementAt: now,
    })
    .where(
      and(
        eq(usagePeriods.userId, userId),
        eq(usagePeriods.periodStart, periodStart),
      ),
    )
    .returning({ emailsSent: usagePeriods.emailsSent });

  if (updated.length === 0) {
    const current = await database.query.usagePeriods.findFirst({
      where: and(
        eq(usagePeriods.userId, userId),
        eq(usagePeriods.periodStart, periodStart),
      ),
    });
    return {
      ok: false,
      info: {
        resource: "emails",
        plan: plan.slug,
        limit: plan.monthlyEmailQuota,
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
  if (delta <= 0 || !userId) return;

  try {
    const entitlement = await resolveBillingEntitlement(
      userId,
      now,
      env,
      database,
    );
    if (entitlement.mode !== "active") return;
    await database
      .update(usagePeriods)
      .set({
        emailsSent: sql`GREATEST(${usagePeriods.emailsSent} - ${delta}, 0)`,
      })
      .where(
        and(
          eq(usagePeriods.userId, userId),
          eq(usagePeriods.periodStart, entitlement.periodStart),
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
  if (!userId) return { ok: true, bypassed: true };

  const entitlement = await resolveBillingEntitlement(
    userId,
    now,
    env,
    database,
  );
  if (entitlement.mode === "self_host") return { ok: true, bypassed: true };
  if (entitlement.mode === "blocked") {
    return { ok: false, info: blockedInfo("domains", entitlement.reason) };
  }

  const [row] = await database
    .select({ value: count() })
    .from(domains)
    .where(eq(domains.userId, userId));

  const used = Number(row?.value ?? 0);
  if (used >= entitlement.plan.maxDomains) {
    return {
      ok: false,
      info: {
        resource: "domains",
        plan: entitlement.plan.slug,
        limit: entitlement.plan.maxDomains,
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
  if (!userId) return { ok: true, bypassed: true };

  const entitlement = await resolveBillingEntitlement(
    userId,
    now,
    env,
    database,
  );
  if (entitlement.mode === "self_host") return { ok: true, bypassed: true };
  if (entitlement.mode === "blocked") {
    return { ok: false, info: blockedInfo("api_keys", entitlement.reason) };
  }

  const [row] = await database
    .select({ value: count() })
    .from(apiKeys)
    .where(eq(apiKeys.userId, userId));

  const used = Number(row?.value ?? 0);
  if (used >= entitlement.plan.maxApiKeys) {
    return {
      ok: false,
      info: {
        resource: "api_keys",
        plan: entitlement.plan.slug,
        limit: entitlement.plan.maxApiKeys,
        used,
        upgrade_url: UPGRADE_URL,
      },
    };
  }
  return { ok: true, bypassed: false };
}

/**
 * Gate a hosted mutating action (create/update/delete of contacts, segments,
 * topics, broadcasts). Self-host bypasses; hosted requires an active paid
 * subscription. Returns a QuotaResult so routes can `quotaExceededResponse`.
 */
export async function checkMutationAllowed(
  userId: string | null | undefined,
  now: Date = new Date(),
  env: Record<string, string | undefined> = process.env,
  database: BillingDb = db,
): Promise<QuotaResult> {
  if (!userId) return { ok: true, bypassed: true };

  const entitlement = await resolveBillingEntitlement(
    userId,
    now,
    env,
    database,
  );
  if (entitlement.mode === "self_host") return { ok: true, bypassed: true };
  if (entitlement.mode === "blocked") {
    return { ok: false, info: blockedInfo("mutation", entitlement.reason) };
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
