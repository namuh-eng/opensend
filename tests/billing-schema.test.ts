import {
  plans,
  stripeCustomers,
  subscriptions,
  usagePeriods,
} from "@/lib/db/schema";
import { getTableColumns, getTableName } from "drizzle-orm";
import { describe, expect, it } from "vitest";

describe("Billing schema", () => {
  it("registers all four billing tables with the expected names", () => {
    expect(getTableName(plans)).toBe("plans");
    expect(getTableName(subscriptions)).toBe("subscriptions");
    expect(getTableName(stripeCustomers)).toBe("stripe_customers");
    expect(getTableName(usagePeriods)).toBe("usage_periods");
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
    expect(cols.lastIncrementAt).toBeDefined();
    expect(cols.userId.notNull).toBe(true);
    expect(cols.periodStart.notNull).toBe(true);
    expect(cols.periodEnd.notNull).toBe(true);
    expect(cols.emailsSent.notNull).toBe(true);
  });
});
