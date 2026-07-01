import { and, eq, sql } from "drizzle-orm";
import { resolveBillingEntitlement } from "../billing/entitlement";
import { db } from "../db/client";
import { usagePeriods } from "../db/schema";

type BillingDb = Pick<typeof db, "insert" | "query" | "update" | "select">;

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

async function ensureUsagePeriod(input: {
  userId: string;
  periodStart: Date;
  periodEnd: Date;
  includedEmailQuota: number;
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
      includedEmailQuota: input.includedEmailQuota,
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
  if (delta <= 0 || !userId) {
    return { ok: true, bypassed: true };
  }

  const entitlement = await resolveBillingEntitlement(
    userId,
    now,
    env,
    database,
  );
  // Self-host (billing disabled) grants everything.
  if (entitlement.mode === "self_host") {
    return { ok: true, bypassed: true };
  }
  // Hosted without an active paid subscription is blocked (402 upstream).
  if (entitlement.mode === "blocked") {
    return {
      ok: false,
      info: { resource: "emails", plan: entitlement.reason, limit: 0, used: 0 },
    };
  }

  const { plan, periodStart, periodEnd } = entitlement;
  await ensureUsagePeriod({
    userId,
    periodStart,
    periodEnd,
    includedEmailQuota: plan.monthlyEmailQuota,
    database,
  });

  // Paid plans increment past the included quota so overage can be reported
  // asynchronously from the committed usage period (no hard cap).
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

  if (updated.length > 0) return { ok: true, bypassed: false };

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
    // Best-effort compensation only.
  }
}
