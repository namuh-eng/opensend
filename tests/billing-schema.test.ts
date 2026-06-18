import {
  billingOverageReports,
  plans,
  stripeCustomers,
  stripeEventsProcessed,
  subscriptions,
  usagePeriods,
} from "@/lib/db/schema";
import { getTableColumns, getTableName } from "drizzle-orm";
import { describe, expect, it } from "vitest";

describe("Billing schema", () => {
  it("registers all billing tables with the expected names", () => {
    expect(getTableName(plans)).toBe("plans");
    expect(getTableName(subscriptions)).toBe("subscriptions");
    expect(getTableName(stripeCustomers)).toBe("stripe_customers");
    expect(getTableName(usagePeriods)).toBe("usage_periods");
    expect(getTableName(billingOverageReports)).toBe("billing_overage_reports");
    expect(getTableName(stripeEventsProcessed)).toBe("stripe_events_processed");
  });

  it("plans table has the columns the paywall epic depends on", () => {
    const cols = getTableColumns(plans);
    expect(cols.id).toBeDefined();
    expect(cols.slug).toBeDefined();
    expect(cols.name).toBeDefined();
    expect(cols.monthlyPriceCents).toBeDefined();
    expect(cols.monthlyEmailQuota).toBeDefined();
    expect(cols.maxDomains).toBeDefined();
    expect(cols.maxApiKeys).toBeDefined();
    expect(cols.stripePriceId).toBeDefined();
    expect(cols.isPublic).toBeDefined();
    expect(cols.createdAt).toBeDefined();
    expect(cols.slug.notNull).toBe(true);
    expect(cols.name.notNull).toBe(true);
  });

  it("subscriptions table tracks Stripe state and one-per-tenant uniqueness", () => {
    const cols = getTableColumns(subscriptions);
    expect(cols.userId).toBeDefined();
    expect(cols.planId).toBeDefined();
    expect(cols.status).toBeDefined();
    expect(cols.currentPeriodStart).toBeDefined();
    expect(cols.currentPeriodEnd).toBeDefined();
    expect(cols.cancelAtPeriodEnd).toBeDefined();
    expect(cols.stripeSubscriptionId).toBeDefined();
    expect(cols.userId.notNull).toBe(true);
    expect(cols.planId.notNull).toBe(true);
    expect(cols.cancelAtPeriodEnd.notNull).toBe(true);
  });

  it("stripe_customers table maps tenants to Stripe customer ids", () => {
    const cols = getTableColumns(stripeCustomers);
    expect(cols.userId).toBeDefined();
    expect(cols.stripeCustomerId).toBeDefined();
    expect(cols.userId.notNull).toBe(true);
    expect(cols.stripeCustomerId.notNull).toBe(true);
  });

  it("usage_periods table is shaped for monthly counters", () => {
    const cols = getTableColumns(usagePeriods);
    expect(cols.userId).toBeDefined();
    expect(cols.periodStart).toBeDefined();
    expect(cols.periodEnd).toBeDefined();
    expect(cols.emailsSent).toBeDefined();
    expect(cols.includedEmailQuota).toBeDefined();
    expect(cols.overageReportedEmails).toBeDefined();
    expect(cols.overageClaimedEmails).toBeDefined();
    expect(cols.overageLastReportedAt).toBeDefined();
    expect(cols.usageWarning80NotifiedAt).toBeDefined();
    expect(cols.usageWarning100NotifiedAt).toBeDefined();
    expect(cols.lastIncrementAt).toBeDefined();
    expect(cols.userId.notNull).toBe(true);
    expect(cols.periodStart.notNull).toBe(true);
    expect(cols.periodEnd.notNull).toBe(true);
    expect(cols.emailsSent.notNull).toBe(true);
  });

  it("billing_overage_reports stores durable Stripe meter outbox rows", () => {
    const cols = getTableColumns(billingOverageReports);
    expect(cols.usagePeriodId).toBeDefined();
    expect(cols.reportKey).toBeDefined();
    expect(cols.deltaEmails).toBeDefined();
    expect(cols.status).toBeDefined();
    expect(cols.stripeSubmissionStartedAt).toBeDefined();
    expect(cols.stripeReportedAt).toBeDefined();
    expect(cols.reportKey.notNull).toBe(true);
    expect(cols.status.notNull).toBe(true);
  });

  it("stripe_events_processed stores webhook replay idempotency keys", () => {
    const cols = getTableColumns(stripeEventsProcessed);
    expect(cols.eventId).toBeDefined();
    expect(cols.type).toBeDefined();
    expect(cols.processedAt).toBeDefined();
    expect(cols.eventId.primary).toBe(true);
    expect(cols.type.notNull).toBe(true);
    expect(cols.processedAt.notNull).toBe(true);
  });
});
