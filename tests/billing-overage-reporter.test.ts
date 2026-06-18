import { describe, expect, it, vi } from "vitest";
import {
  type ClaimedOverageReport,
  type ReportableUsagePeriod,
  canReportOverageForSubscriptionPeriod,
  reportBillingOverageUsage,
} from "../packages/ingester/src/billing-overage-reporter";

const stripeEnv = {
  BILLING_BACKEND: "stripe",
  STRIPE_SECRET_KEY: "sk_test_overage",
  STRIPE_OVERAGE_METER_EVENT_NAME: "opensend_test_overage",
};

const now = new Date("2026-06-18T12:00:00.000Z");

function usage(overrides: Partial<ReportableUsagePeriod> = {}) {
  return {
    usagePeriodId: "usage_123",
    stripeCustomerId: "cus_123",
    stripeSubscriptionId: "sub_123",
    emailsSent: 1_250,
    includedEmails: 1_000,
    overageReportedEmails: 100,
    periodStart: new Date("2026-06-01T00:00:00.000Z"),
    periodEnd: new Date("2026-07-01T00:00:00.000Z"),
    ...overrides,
  } satisfies ReportableUsagePeriod;
}

function claimedReport(overrides: Partial<ClaimedOverageReport> = {}) {
  return {
    id: "report_123",
    reportKey: "opensend_overage:usage_123:101-250",
    usagePeriodId: "usage_123",
    stripeCustomerId: "cus_123",
    stripeSubscriptionId: "sub_123",
    deltaEmails: 150,
    throughOverageEmails: 250,
    periodEnd: new Date("2026-07-01T00:00:00.000Z"),
    ...overrides,
  } satisfies ClaimedOverageReport;
}

function stripeMock() {
  return {
    billing: {
      meterEvents: {
        create: vi.fn(async () => ({ id: "mtr_evt_123" })),
      },
    },
  };
}

describe("billing overage reporter", () => {
  it("skips safely when hosted Stripe billing is disabled", async () => {
    const stripe = stripeMock();

    await expect(
      reportBillingOverageUsage({
        env: { BILLING_BACKEND: "disabled" },
        stripe,
        now,
        loadReportableUsagePeriods: async () => [usage()],
        claimOverageReport: vi.fn(),
        markOverageReportReported: vi.fn(),
        markOverageReportFailed: vi.fn(),
      }),
    ).resolves.toEqual({
      status: "skipped",
      reason: "billing_disabled",
      scanned: 0,
      reported: 0,
      skipped: 0,
      failed: 0,
    });
    expect(stripe.billing.meterEvents.create).not.toHaveBeenCalled();
  });

  it("reports only the claimed unreported overage delta with deterministic Stripe idempotency", async () => {
    const stripe = stripeMock();
    const report = claimedReport();
    const claimOverageReport = vi.fn(async () => report);
    const markOverageReportReported = vi.fn(async () => true);
    const markOverageReportFailed = vi.fn(async () => undefined);

    const result = await reportBillingOverageUsage({
      env: stripeEnv,
      stripe,
      now,
      loadReportableUsagePeriods: async () => [usage()],
      claimOverageReport,
      markOverageReportReported,
      markOverageReportFailed,
    });

    expect(result).toEqual({
      status: "ok",
      scanned: 1,
      reported: 1,
      skipped: 0,
      failed: 0,
    });
    expect(claimOverageReport).toHaveBeenCalledWith({
      usage: usage(),
      meterEventName: "opensend_test_overage",
      now,
    });
    expect(stripe.billing.meterEvents.create).toHaveBeenCalledWith(
      {
        event_name: "opensend_test_overage",
        identifier: "opensend_overage:usage_123:101-250",
        payload: {
          stripe_customer_id: "cus_123",
          value: "150",
          opensend_usage_period_id: "usage_123",
          opensend_subscription_id: "sub_123",
        },
        timestamp: Math.floor(now.getTime() / 1000),
      },
      { idempotencyKey: "opensend_overage:usage_123:101-250" },
    );
    expect(markOverageReportReported).toHaveBeenCalledWith({ report, now });
    expect(markOverageReportFailed).not.toHaveBeenCalled();
  });

  it("does not report when the outbox claim is blocked by an active in-flight report", async () => {
    const stripe = stripeMock();

    const result = await reportBillingOverageUsage({
      env: stripeEnv,
      stripe,
      now,
      loadReportableUsagePeriods: async () => [
        usage({
          emailsSent: 1_250,
          includedEmails: 1_000,
          overageReportedEmails: 250,
        }),
      ],
      claimOverageReport: vi.fn(async () => null),
      markOverageReportReported: vi.fn(async () => true),
      markOverageReportFailed: vi.fn(async () => undefined),
    });

    expect(result).toEqual({
      status: "ok",
      scanned: 1,
      reported: 0,
      skipped: 1,
      failed: 0,
    });
    expect(stripe.billing.meterEvents.create).not.toHaveBeenCalled();
  });

  it("keeps processing later periods when one Stripe report fails", async () => {
    const stripe = stripeMock();
    stripe.billing.meterEvents.create
      .mockRejectedValueOnce(new Error("stripe unavailable"))
      .mockResolvedValueOnce({ id: "mtr_evt_456" });
    const firstReport = claimedReport({ id: "report_failed" });
    const secondReport = claimedReport({
      id: "report_ok",
      reportKey: "opensend_overage:usage_456:1-20",
      usagePeriodId: "usage_456",
      deltaEmails: 20,
      throughOverageEmails: 20,
    });
    const markOverageReportFailed = vi.fn(async () => undefined);
    const markOverageReportReported = vi.fn(async () => true);

    const result = await reportBillingOverageUsage({
      env: stripeEnv,
      stripe,
      now,
      loadReportableUsagePeriods: async () => [
        usage(),
        usage({
          usagePeriodId: "usage_456",
          emailsSent: 1_020,
          overageReportedEmails: 0,
        }),
      ],
      claimOverageReport: vi
        .fn()
        .mockResolvedValueOnce(firstReport)
        .mockResolvedValueOnce(secondReport),
      markOverageReportReported,
      markOverageReportFailed,
    });

    expect(result).toEqual({
      status: "ok",
      scanned: 2,
      reported: 1,
      skipped: 0,
      failed: 1,
    });
    expect(markOverageReportFailed).toHaveBeenCalledWith({
      report: firstReport,
      now,
      error: expect.any(Error),
    });
    expect(markOverageReportReported).toHaveBeenCalledWith({
      report: secondReport,
      now,
    });
  });
});

describe("billing overage subscription status eligibility", () => {
  const cutoff = new Date("2026-05-19T12:00:00.000Z");
  const endedPeriod = new Date("2026-06-01T00:00:00.000Z");
  const openPeriod = new Date("2026-07-01T00:00:00.000Z");

  it.each(["active", "past_due"])(
    "allows %s subscriptions to catch up recent ended periods and current periods",
    (subscriptionStatus) => {
      expect(
        canReportOverageForSubscriptionPeriod({
          subscriptionStatus,
          subscriptionCurrentPeriodEnd: openPeriod,
          usagePeriodEnd: endedPeriod,
          now,
          cutoff,
        }),
      ).toBe(true);
      expect(
        canReportOverageForSubscriptionPeriod({
          subscriptionStatus,
          subscriptionCurrentPeriodEnd: openPeriod,
          usagePeriodEnd: openPeriod,
          now,
          cutoff,
        }),
      ).toBe(true);
    },
  );

  it.each(["canceled", "unpaid"])(
    "only allows %s subscriptions as final catch-up for a fully ended billing period",
    (subscriptionStatus) => {
      expect(
        canReportOverageForSubscriptionPeriod({
          subscriptionStatus,
          subscriptionCurrentPeriodEnd: endedPeriod,
          usagePeriodEnd: endedPeriod,
          now,
          cutoff,
        }),
      ).toBe(true);
      expect(
        canReportOverageForSubscriptionPeriod({
          subscriptionStatus,
          subscriptionCurrentPeriodEnd: endedPeriod,
          usagePeriodEnd: openPeriod,
          now,
          cutoff,
        }),
      ).toBe(false);
      expect(
        canReportOverageForSubscriptionPeriod({
          subscriptionStatus,
          subscriptionCurrentPeriodEnd: null,
          usagePeriodEnd: endedPeriod,
          now,
          cutoff,
        }),
      ).toBe(false);
    },
  );

  it("does not report stale ended periods outside the catch-up window", () => {
    expect(
      canReportOverageForSubscriptionPeriod({
        subscriptionStatus: "active",
        subscriptionCurrentPeriodEnd: openPeriod,
        usagePeriodEnd: cutoff,
        now,
        cutoff,
      }),
    ).toBe(false);
  });
});
