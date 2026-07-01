// E2E category: real-dependency API/DB paywall scenario. Requires billing env
// (BILLING_BACKEND=stripe + STRIPE_SECRET_KEY) so the hosted paywall
// (resolveBillingEntitlement) actually runs against real Next.js routes + real
// Postgres. The block path makes NO Stripe network calls, and the paid-path send
// is persisted as status "queued" (no synchronous SES send), so these assertions
// are deterministic without external services.
import { expect, test } from "./fixtures/auth";

const billingEnabled =
  process.env.BILLING_BACKEND?.toLowerCase() === "stripe" &&
  Boolean(process.env.STRIPE_SECRET_KEY);

const sendBody = (runId: string) => ({
  from: "sender@example.com",
  to: `paywall@${runId}.e2e.opensend.test`,
  subject: "Paywall probe",
  html: "<p>Paywall probe</p>",
});

// Insert a plan row and return its id. `priceCents` of 0 yields a legacy/zero-price
// plan which is NOT paid, so an active subscription on it is still blocked.
async function insertPlan(
  // biome-ignore lint/suspicious/noExplicitAny: pg Client typed loosely in fixtures
  db: any,
  slug: string,
  priceCents: number,
): Promise<string> {
  const { rows } = await db.query(
    `insert into plans (
       slug, name, monthly_price_cents, monthly_email_quota,
       daily_email_quota, max_domains, max_api_keys, max_contacts,
       max_segments, max_broadcasts, rate_per_second, stripe_price_id,
       stripe_overage_price_id, is_public
     ) values ($1, 'E2E Paywall', $2, 1000, 1000, 10, 10, 100000, 100, 100, 10,
               'price_e2e_paywall', 'price_e2e_paywall_overage', false)
     on conflict (slug) do update set
       monthly_price_cents = excluded.monthly_price_cents,
       monthly_email_quota = excluded.monthly_email_quota
     returning id`,
    [slug, priceCents],
  );
  return (rows[0]?.id as string) ?? "";
}

async function activateSubscription(
  // biome-ignore lint/suspicious/noExplicitAny: pg Client typed loosely in fixtures
  db: any,
  userId: string,
  planId: string,
  runId: string,
): Promise<void> {
  // Period brackets "now" (2026-07) so the active/past_due grace logic passes.
  const periodStart = new Date("2026-06-15T00:00:00.000Z");
  const periodEnd = new Date("2026-08-15T00:00:00.000Z");
  await db.query(
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
    [userId, planId, periodStart, periodEnd, `sub_${runId}`],
  );
}

test.describe("hosted free-tier removal paywall", () => {
  test.skip(
    !billingEnabled,
    "Requires BILLING_BACKEND=stripe + STRIPE_SECRET_KEY so the hosted paywall runs.",
  );

  test("unpaid hosted tenant is blocked (402) across billable surfaces", async ({
    e2eApiRequest,
    e2eRunId,
  }) => {
    // Default e2eTenant has NO subscription -> resolver returns blocked:no_subscription.
    const send = await e2eApiRequest.post("/api/emails", {
      data: sendBody(e2eRunId),
    });
    expect(send.status()).toBe(402);
    expect(((await send.json()) as { code: string }).code).toBe(
      "quota_exceeded",
    );

    const contact = await e2eApiRequest.post("/api/contacts", {
      data: { email: `c@${e2eRunId}.e2e.opensend.test` },
    });
    expect(contact.status()).toBe(402);
    expect(((await contact.json()) as { code: string }).code).toBe(
      "quota_exceeded",
    );

    const segment = await e2eApiRequest.post("/api/segments", {
      data: { name: `seg-${e2eRunId}` },
    });
    expect(segment.status()).toBe(402);

    const broadcast = await e2eApiRequest.post("/api/broadcasts", {
      data: {
        name: `bc-${e2eRunId}`,
        from: "sender@example.com",
        subject: "Blocked broadcast",
        html: "<p>Blocked broadcast</p>",
      },
    });
    expect(broadcast.status()).toBe(402);
  });

  test("active paid subscription unblocks sending (200 queued)", async ({
    e2eApiRequest,
    e2eDb,
    e2eRunId,
    e2eTenant,
  }) => {
    const planSlug = `e2e-paid-${e2eRunId}`.slice(0, 60);
    let planId: string | null = null;
    try {
      planId = await insertPlan(e2eDb, planSlug, 1900);
      expect(planId).toBeTruthy();
      await activateSubscription(e2eDb, e2eTenant.user.id, planId, e2eRunId);

      const send = await e2eApiRequest.post("/api/emails", {
        data: sendBody(e2eRunId),
      });
      expect(send.status()).toBe(200);
      expect(((await send.json()) as { id: string }).id).toBeTruthy();
    } finally {
      await e2eDb.query("delete from subscriptions where user_id = $1", [
        e2eTenant.user.id,
      ]);
      if (planId) {
        await e2eDb.query("delete from plans where id = $1", [planId]);
      }
    }
  });

  test("active subscription on a zero-price plan stays blocked (402 legacy_free)", async ({
    e2eApiRequest,
    e2eDb,
    e2eRunId,
    e2eTenant,
  }) => {
    const planSlug = `e2e-free-${e2eRunId}`.slice(0, 60);
    let planId: string | null = null;
    try {
      // monthly_price_cents = 0 -> isPaidPlan() false -> blocked:legacy_free
      planId = await insertPlan(e2eDb, planSlug, 0);
      expect(planId).toBeTruthy();
      await activateSubscription(e2eDb, e2eTenant.user.id, planId, e2eRunId);

      const send = await e2eApiRequest.post("/api/emails", {
        data: sendBody(e2eRunId),
      });
      expect(send.status()).toBe(402);
      expect(((await send.json()) as { code: string }).code).toBe(
        "quota_exceeded",
      );
    } finally {
      await e2eDb.query("delete from subscriptions where user_id = $1", [
        e2eTenant.user.id,
      ]);
      if (planId) {
        await e2eDb.query("delete from plans where id = $1", [planId]);
      }
    }
  });
});

test.describe("self-host bypass (billing disabled)", () => {
  test.skip(
    billingEnabled,
    "Runs only when billing is disabled; proves self-host grants everything free.",
  );

  test("unpaid tenant with billing disabled is NOT blocked (self_host)", async ({
    e2eApiRequest,
    e2eRunId,
  }) => {
    // No subscription, but billing disabled -> resolver returns self_host -> allow.
    const contact = await e2eApiRequest.post("/api/contacts", {
      data: { email: `selfhost@${e2eRunId}.e2e.opensend.test` },
    });
    expect(contact.status()).not.toBe(402);
    expect(contact.status()).toBeLessThan(300);

    const send = await e2eApiRequest.post("/api/emails", {
      data: sendBody(e2eRunId),
    });
    expect(send.status()).not.toBe(402);
    expect(send.status()).toBe(200);
  });
});
