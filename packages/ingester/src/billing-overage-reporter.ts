import {
  billingOverageReports,
  db,
  plans,
  stripeCustomers,
  subscriptions,
  usagePeriods,
} from "@opensend/core";
import { and, asc, eq, gt, inArray, isNotNull, lt, or, sql } from "drizzle-orm";
import Stripe from "stripe";

const REPORTABLE_BILLING_STATUSES = [
  "active",
  "trialing",
  "past_due",
  "canceled",
  "unpaid",
] as const;
const DEFAULT_METER_EVENT_NAME = "opensend_email_overage";
const STRIPE_API_VERSION = "2026-04-22.dahlia" as const;
const ENDED_PERIOD_CATCHUP_MS = 30 * 24 * 60 * 60 * 1000;
const REPORT_LEASE_MS = 10 * 60 * 1000;

export interface OverageReportResult {
  status: "skipped" | "ok";
  reason?: string;
  scanned: number;
  reported: number;
  skipped: number;
  failed: number;
}

interface StripeMeterEventClient {
  billing: {
    meterEvents: {
      create(
        params: {
          event_name: string;
          identifier: string;
          payload: Record<string, string>;
          timestamp?: number;
        },
        options?: { idempotencyKey?: string },
      ): Promise<unknown>;
    };
  };
}

export interface ReportableUsagePeriod {
  usagePeriodId: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  emailsSent: number;
  includedEmails: number;
  overageReportedEmails: number;
  periodStart: Date;
  periodEnd: Date;
}

export interface ClaimedOverageReport {
  id: string;
  reportKey: string;
  usagePeriodId: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  deltaEmails: number;
  throughOverageEmails: number;
  periodEnd: Date;
}

function getBillingBackend(
  env: Record<string, string | undefined> = process.env,
): "stripe" | "disabled" {
  return env.BILLING_BACKEND?.trim().toLowerCase() === "stripe" &&
    Boolean(env.STRIPE_SECRET_KEY?.trim())
    ? "stripe"
    : "disabled";
}

function getMeterEventName(env: Record<string, string | undefined>): string {
  return (
    env.STRIPE_OVERAGE_METER_EVENT_NAME?.trim() || DEFAULT_METER_EVENT_NAME
  );
}

let cachedClient: Stripe | null = null;
let cachedClientKey: string | null = null;

function getStripeClient(env: Record<string, string | undefined>) {
  const secret = env.STRIPE_SECRET_KEY?.trim();
  if (!secret) {
    throw new Error("STRIPE_SECRET_KEY is required for overage reporting");
  }
  if (cachedClient && cachedClientKey === secret) return cachedClient;
  cachedClient = new Stripe(secret, {
    apiVersion: STRIPE_API_VERSION,
    typescript: true,
    appInfo: { name: "opensend-ingester" },
  });
  cachedClientKey = secret;
  return cachedClient;
}

export function __resetOverageStripeForTests() {
  cachedClient = null;
  cachedClientKey = null;
}

function reportablePeriodCutoff(now: Date): Date {
  return new Date(now.getTime() - ENDED_PERIOD_CATCHUP_MS);
}

async function loadDefaultReportableUsagePeriods(
  now: Date,
): Promise<ReportableUsagePeriod[]> {
  const includedEmails = sql<number>`COALESCE(${usagePeriods.includedEmailQuota}, ${plans.monthlyEmailQuota})`;
  const rows = await db
    .select({
      usagePeriodId: usagePeriods.id,
      stripeCustomerId: stripeCustomers.stripeCustomerId,
      stripeSubscriptionId: subscriptions.stripeSubscriptionId,
      emailsSent: usagePeriods.emailsSent,
      includedEmails,
      overageReportedEmails: usagePeriods.overageReportedEmails,
      periodStart: usagePeriods.periodStart,
      periodEnd: usagePeriods.periodEnd,
    })
    .from(usagePeriods)
    .innerJoin(subscriptions, eq(subscriptions.userId, usagePeriods.userId))
    .innerJoin(plans, eq(plans.id, subscriptions.planId))
    .innerJoin(stripeCustomers, eq(stripeCustomers.userId, usagePeriods.userId))
    .where(
      and(
        inArray(subscriptions.status, [...REPORTABLE_BILLING_STATUSES]),
        gt(usagePeriods.periodEnd, reportablePeriodCutoff(now)),
        isNotNull(subscriptions.stripeSubscriptionId),
        isNotNull(plans.stripeOveragePriceId),
        gt(
          sql<number>`GREATEST(${usagePeriods.emailsSent} - ${includedEmails}, 0)`,
          usagePeriods.overageReportedEmails,
        ),
      ),
    );

  return rows.flatMap((row) => {
    if (!row.stripeSubscriptionId) return [];
    return [
      {
        usagePeriodId: row.usagePeriodId,
        stripeCustomerId: row.stripeCustomerId,
        stripeSubscriptionId: row.stripeSubscriptionId,
        emailsSent: row.emailsSent,
        includedEmails: row.includedEmails,
        overageReportedEmails: row.overageReportedEmails,
        periodStart: row.periodStart,
        periodEnd: row.periodEnd,
      },
    ];
  });
}

function buildReportIdentity(input: {
  usagePeriodId: string;
  fromOverageEmails: number;
  throughOverageEmails: number;
}) {
  return `opensend_overage:${input.usagePeriodId}:${input.fromOverageEmails}-${input.throughOverageEmails}`;
}

function truncateError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, 1000);
}

async function claimDefaultOverageReport(input: {
  usage: ReportableUsagePeriod;
  meterEventName: string;
  now: Date;
}): Promise<ClaimedOverageReport | null> {
  const leaseCutoff = new Date(input.now.getTime() - REPORT_LEASE_MS);

  return await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({
        id: billingOverageReports.id,
        reportKey: billingOverageReports.reportKey,
        usagePeriodId: billingOverageReports.usagePeriodId,
        stripeCustomerId: billingOverageReports.stripeCustomerId,
        stripeSubscriptionId: billingOverageReports.stripeSubscriptionId,
        deltaEmails: billingOverageReports.deltaEmails,
        throughOverageEmails: billingOverageReports.throughOverageEmails,
        status: billingOverageReports.status,
        stripeSubmissionStartedAt:
          billingOverageReports.stripeSubmissionStartedAt,
      })
      .from(billingOverageReports)
      .where(
        and(
          eq(billingOverageReports.usagePeriodId, input.usage.usagePeriodId),
          or(
            eq(billingOverageReports.status, "pending"),
            eq(billingOverageReports.status, "failed"),
            eq(billingOverageReports.status, "sending"),
          ),
        ),
      )
      .orderBy(asc(billingOverageReports.fromOverageEmails))
      .limit(1)
      .for("update");

    if (existing) {
      const sendingStartedAt = existing.stripeSubmissionStartedAt;
      const sendingIsStillLeased =
        existing.status === "sending" &&
        sendingStartedAt !== null &&
        sendingStartedAt >= leaseCutoff;
      if (sendingIsStillLeased) return null;

      const [claimedExisting] = await tx
        .update(billingOverageReports)
        .set({
          status: "sending",
          attemptCount: sql`${billingOverageReports.attemptCount} + 1`,
          stripeSubmissionStartedAt: input.now,
          lastError: null,
          updatedAt: input.now,
        })
        .where(eq(billingOverageReports.id, existing.id))
        .returning({ id: billingOverageReports.id });

      if (!claimedExisting) return null;
      return {
        id: existing.id,
        reportKey: existing.reportKey,
        usagePeriodId: existing.usagePeriodId,
        stripeCustomerId: existing.stripeCustomerId,
        stripeSubscriptionId: existing.stripeSubscriptionId,
        deltaEmails: existing.deltaEmails,
        throughOverageEmails: existing.throughOverageEmails,
        periodEnd: input.usage.periodEnd,
      };
    }

    const [period] = await tx
      .select({
        emailsSent: usagePeriods.emailsSent,
        includedEmailQuota: usagePeriods.includedEmailQuota,
        overageReportedEmails: usagePeriods.overageReportedEmails,
        overageClaimedEmails: usagePeriods.overageClaimedEmails,
      })
      .from(usagePeriods)
      .where(eq(usagePeriods.id, input.usage.usagePeriodId))
      .limit(1)
      .for("update");

    if (!period) return null;

    const includedEmails =
      period.includedEmailQuota ?? input.usage.includedEmails;
    const totalOverageEmails = Math.max(period.emailsSent - includedEmails, 0);
    const alreadyClaimedEmails = Math.max(
      period.overageReportedEmails,
      period.overageClaimedEmails,
    );
    const delta = totalOverageEmails - alreadyClaimedEmails;
    if (delta <= 0) return null;

    const fromOverageEmails = alreadyClaimedEmails + 1;
    const reportKey = buildReportIdentity({
      usagePeriodId: input.usage.usagePeriodId,
      fromOverageEmails,
      throughOverageEmails: totalOverageEmails,
    });

    await tx
      .update(usagePeriods)
      .set({ overageClaimedEmails: totalOverageEmails })
      .where(eq(usagePeriods.id, input.usage.usagePeriodId));

    const [inserted] = await tx
      .insert(billingOverageReports)
      .values({
        usagePeriodId: input.usage.usagePeriodId,
        reportKey,
        stripeCustomerId: input.usage.stripeCustomerId,
        stripeSubscriptionId: input.usage.stripeSubscriptionId,
        meterEventName: input.meterEventName,
        fromOverageEmails,
        throughOverageEmails: totalOverageEmails,
        deltaEmails: delta,
        status: "sending",
        attemptCount: 1,
        stripeSubmissionStartedAt: input.now,
        updatedAt: input.now,
      })
      .returning({ id: billingOverageReports.id });

    if (!inserted) return null;

    return {
      id: inserted.id,
      reportKey,
      usagePeriodId: input.usage.usagePeriodId,
      stripeCustomerId: input.usage.stripeCustomerId,
      stripeSubscriptionId: input.usage.stripeSubscriptionId,
      deltaEmails: delta,
      throughOverageEmails: totalOverageEmails,
      periodEnd: input.usage.periodEnd,
    };
  });
}

async function markDefaultOverageReportReported(input: {
  report: ClaimedOverageReport;
  now: Date;
}): Promise<boolean> {
  return await db.transaction(async (tx) => {
    const [reported] = await tx
      .update(billingOverageReports)
      .set({
        status: "reported",
        stripeReportedAt: input.now,
        lastError: null,
        updatedAt: input.now,
      })
      .where(
        and(
          eq(billingOverageReports.id, input.report.id),
          eq(billingOverageReports.status, "sending"),
        ),
      )
      .returning({ id: billingOverageReports.id });

    if (!reported) return false;

    await tx
      .update(usagePeriods)
      .set({
        overageReportedEmails: input.report.throughOverageEmails,
        overageLastReportedAt: input.now,
      })
      .where(
        and(
          eq(usagePeriods.id, input.report.usagePeriodId),
          sql`${usagePeriods.overageReportedEmails} < ${input.report.throughOverageEmails}`,
        ),
      );

    return true;
  });
}

async function markDefaultOverageReportFailed(input: {
  report: ClaimedOverageReport;
  now: Date;
  error: unknown;
}): Promise<void> {
  await db
    .update(billingOverageReports)
    .set({
      status: "failed",
      lastError: truncateError(input.error),
      updatedAt: input.now,
    })
    .where(eq(billingOverageReports.id, input.report.id));
}

function stripeTimestampForReport(report: ClaimedOverageReport, now: Date) {
  const periodEndTimestamp = report.periodEnd.getTime() - 1000;
  const timestampMs = Math.min(now.getTime(), periodEndTimestamp);
  return Math.floor(timestampMs / 1000);
}

async function reportOneUsagePeriod(input: {
  usage: ReportableUsagePeriod;
  meterEventName: string;
  stripe: StripeMeterEventClient;
  now: Date;
  claimOverageReport: (input: {
    usage: ReportableUsagePeriod;
    meterEventName: string;
    now: Date;
  }) => Promise<ClaimedOverageReport | null>;
  markOverageReportReported: (input: {
    report: ClaimedOverageReport;
    now: Date;
  }) => Promise<boolean>;
  markOverageReportFailed: (input: {
    report: ClaimedOverageReport;
    now: Date;
    error: unknown;
  }) => Promise<void>;
}): Promise<"reported" | "skipped" | "failed"> {
  const report = await input.claimOverageReport({
    usage: input.usage,
    meterEventName: input.meterEventName,
    now: input.now,
  });
  if (!report) return "skipped";

  try {
    await input.stripe.billing.meterEvents.create(
      {
        event_name: input.meterEventName,
        identifier: report.reportKey,
        payload: {
          stripe_customer_id: report.stripeCustomerId,
          value: String(report.deltaEmails),
          opensend_usage_period_id: report.usagePeriodId,
          opensend_subscription_id: report.stripeSubscriptionId,
        },
        timestamp: stripeTimestampForReport(report, input.now),
      },
      { idempotencyKey: report.reportKey },
    );

    const marked = await input.markOverageReportReported({
      report,
      now: input.now,
    });
    return marked ? "reported" : "skipped";
  } catch (error) {
    await input.markOverageReportFailed({ report, now: input.now, error });
    return "failed";
  }
}

export async function reportBillingOverageUsage(
  options: {
    env?: Record<string, string | undefined>;
    stripe?: StripeMeterEventClient;
    now?: Date;
    loadReportableUsagePeriods?: (
      now: Date,
    ) => Promise<ReportableUsagePeriod[]>;
    claimOverageReport?: (input: {
      usage: ReportableUsagePeriod;
      meterEventName: string;
      now: Date;
    }) => Promise<ClaimedOverageReport | null>;
    markOverageReportReported?: (input: {
      report: ClaimedOverageReport;
      now: Date;
    }) => Promise<boolean>;
    markOverageReportFailed?: (input: {
      report: ClaimedOverageReport;
      now: Date;
      error: unknown;
    }) => Promise<void>;
  } = {},
): Promise<OverageReportResult> {
  const env = options.env ?? process.env;
  if (getBillingBackend(env) !== "stripe") {
    return {
      status: "skipped",
      reason: "billing_disabled",
      scanned: 0,
      reported: 0,
      skipped: 0,
      failed: 0,
    };
  }

  const now = options.now ?? new Date();
  const stripe = options.stripe ?? getStripeClient(env);
  const meterEventName = getMeterEventName(env);
  const loadUsagePeriods =
    options.loadReportableUsagePeriods ?? loadDefaultReportableUsagePeriods;
  const claimOverageReport =
    options.claimOverageReport ?? claimDefaultOverageReport;
  const markOverageReportReported =
    options.markOverageReportReported ?? markDefaultOverageReportReported;
  const markOverageReportFailed =
    options.markOverageReportFailed ?? markDefaultOverageReportFailed;
  const rows = await loadUsagePeriods(now);
  let reported = 0;
  let skipped = 0;
  let failed = 0;

  for (const usage of rows) {
    const outcome = await reportOneUsagePeriod({
      usage,
      meterEventName,
      stripe,
      now,
      claimOverageReport,
      markOverageReportReported,
      markOverageReportFailed,
    });
    if (outcome === "reported") reported += 1;
    else if (outcome === "failed") failed += 1;
    else skipped += 1;
  }

  return { status: "ok", scanned: rows.length, reported, skipped, failed };
}
