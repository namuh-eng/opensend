// E2E category: provider-gated API/DB scenario. Requires billing env so the real
// send route executes hosted quota logic. Stripe submission is exercised through
// the ingester reporter with a local meter-event mock to avoid external charges.
import { reportBillingOverageUsage } from "../../packages/ingester/src/billing-overage-reporter";
import { expect, test } from "./fixtures/auth";

const billingEnabled =
  process.env.BILLING_BACKEND?.toLowerCase() === "stripe" &&
  Boolean(process.env.STRIPE_SECRET_KEY);

test.describe("paid metered overage send path", () => {
  test.skip(
    !billingEnabled,
    "Requires BILLING_BACKEND=stripe + STRIPE_SECRET_KEY so hosted quota code runs.",
  );

  test("paid plan over-quota send returns 200, records overage, and reports it once", async ({
    e2eApiRequest,
    e2eDb,
    e2eRunId,
    e2eTenant,
  }) => {
    const planSlug = `e2e-overage-${e2eRunId}`.slice(0, 60);
    const periodStart = new Date("2026-06-01T00:00:00.000Z");
    const periodEnd = new Date("2026-07-01T00:00:00.000Z");
    const idempotencyKey = `overage-${e2eRunId}`;
    let planId: string | null = null;

    const stripe = {
      billing: {
        meterEvents: {
          create: async () => ({ id: `mtr_evt_${e2eRunId}` }),
        },
      },
    };

    try {
      const planRows = await e2eDb.query<{ id: string }>(
        `insert into plans (
           slug, name, monthly_price_cents, monthly_email_quota,
           daily_email_quota, max_domains, max_api_keys, max_contacts,
           max_segments, max_broadcasts, rate_per_second, stripe_price_id,
           stripe_overage_price_id, is_public
         ) values ($1, 'E2E Overage', 1900, 1, 100, 10, 10, 1000, 10, null, 10,
                   'price_e2e_base', 'price_e2e_overage', false)
         on conflict (slug) do update set
           monthly_email_quota = excluded.monthly_email_quota,
           stripe_price_id = excluded.stripe_price_id,
           stripe_overage_price_id = excluded.stripe_overage_price_id
         returning id`,
        [planSlug],
      );
      planId = planRows.rows[0]?.id ?? null;
      expect(planId).toBeTruthy();

      await e2eDb.query(
        `insert into subscriptions (
           user_id, plan_id, status, current_period_start, current_period_end,
           stripe_subscription_id
         ) values ($1, $2, 'active', $3, $4, $5)
         on conflict (user_id) do update set
           plan_id = excluded.plan_id,
           status = excluded.status,
           current_period_start = excluded.current_period_start,
           current_period_end = excluded.current_period_end,
           stripe_subscription_id = excluded.stripe_subscription_id`,
        [e2eTenant.user.id, planId, periodStart, periodEnd, `sub_${e2eRunId}`],
      );
      await e2eDb.query(
        `insert into stripe_customers (user_id, stripe_customer_id)
         values ($1, $2)
         on conflict (user_id) do update set
           stripe_customer_id = excluded.stripe_customer_id`,
        [e2eTenant.user.id, `cus_${e2eRunId}`],
      );
      await e2eDb.query(
        `insert into usage_periods (
           user_id, period_start, period_end, emails_sent,
           included_email_quota, overage_reported_emails
         ) values ($1, $2, $3, 0, 1, 0)
         on conflict (user_id, period_start) do update set
           period_end = excluded.period_end,
           emails_sent = excluded.emails_sent,
           included_email_quota = excluded.included_email_quota,
           overage_reported_emails = excluded.overage_reported_emails`,
        [e2eTenant.user.id, periodStart, periodEnd],
      );

      const warmup = await e2eApiRequest.post("/emails", {
        data: {
          from: "sender@example.com",
          to: `warmup@${e2eRunId}.e2e.opensend.test`,
          subject: "Paid quota warmup",
          html: "<p>Paid quota warmup</p>",
        },
      });
      expect(warmup.status()).toBe(200);

      const first = await e2eApiRequest.post("/emails", {
        headers: { "Idempotency-Key": idempotencyKey },
        data: {
          from: "sender@example.com",
          to: `overage@${e2eRunId}.e2e.opensend.test`,
          subject: "Paid overage accepted",
          html: "<p>Paid overage accepted</p>",
        },
      });
      expect(first.status()).toBe(200);
      const firstBody = (await first.json()) as { id: string };
      expect(firstBody.id).toBeTruthy();

      const retry = await e2eApiRequest.post("/emails", {
        headers: { "Idempotency-Key": idempotencyKey },
        data: {
          from: "sender@example.com",
          to: `overage@${e2eRunId}.e2e.opensend.test`,
          subject: "Paid overage accepted",
          html: "<p>Paid overage accepted</p>",
        },
      });
      expect(retry.status()).toBe(200);
      await expect(retry.json()).resolves.toEqual(firstBody);

      const reportResult = await reportBillingOverageUsage({
        env: {
          BILLING_BACKEND: "stripe",
          STRIPE_SECRET_KEY: "sk_test_e2e_overage",
          STRIPE_OVERAGE_METER_EVENT_NAME: "opensend_e2e_overage",
        },
        stripe,
        now: new Date("2026-06-18T12:00:00.000Z"),
      });
      expect(reportResult).toMatchObject({
        status: "ok",
        scanned: 1,
        reported: 1,
        failed: 0,
      });

      const duplicateReportResult = await reportBillingOverageUsage({
        env: {
          BILLING_BACKEND: "stripe",
          STRIPE_SECRET_KEY: "sk_test_e2e_overage",
          STRIPE_OVERAGE_METER_EVENT_NAME: "opensend_e2e_overage",
        },
        stripe,
        now: new Date("2026-06-18T12:01:00.000Z"),
      });
      expect(duplicateReportResult).toMatchObject({
        status: "ok",
        reported: 0,
        failed: 0,
      });

      const usageRows = await e2eDb.query<{
        emails_sent: number;
        overage_reported_emails: number;
        warning_80: Date | null;
        warning_100: Date | null;
        accepted_rows: string;
        report_rows: string;
      }>(
        `select up.emails_sent,
                up.overage_reported_emails,
                up.usage_warning_80_notified_at as warning_80,
                up.usage_warning_100_notified_at as warning_100,
                (
                  select count(*)::text
                    from emails
                   where user_id = $1 and subject = 'Paid overage accepted'
                ) as accepted_rows,
                (
                  select count(*)::text
                    from billing_overage_reports bor
                   where bor.usage_period_id = up.id and bor.status = 'reported'
                ) as report_rows
           from usage_periods up
          where up.user_id = $1 and up.period_start = $2`,
        [e2eTenant.user.id, periodStart],
      );

      expect(usageRows.rows[0]).toMatchObject({
        emails_sent: 2,
        overage_reported_emails: 1,
        accepted_rows: "1",
        report_rows: "1",
      });
      expect(usageRows.rows[0]?.warning_80).toBeTruthy();
      expect(usageRows.rows[0]?.warning_100).toBeTruthy();
    } finally {
      await e2eDb.query(
        `delete from billing_overage_reports
          where usage_period_id in (
            select id from usage_periods where user_id = $1
          )`,
        [e2eTenant.user.id],
      );
      await e2eDb.query("delete from usage_periods where user_id = $1", [
        e2eTenant.user.id,
      ]);
      await e2eDb.query("delete from stripe_customers where user_id = $1", [
        e2eTenant.user.id,
      ]);
      await e2eDb.query("delete from subscriptions where user_id = $1", [
        e2eTenant.user.id,
      ]);
      if (planId) {
        await e2eDb.query("delete from plans where id = $1", [planId]);
      }
    }
  });
});
