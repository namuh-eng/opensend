# Hosted Stripe billing cutover runbook

Issue #297 is the hosted deployment cutover for the Stripe paywall slices that
landed under #132. This runbook separates repo-owned readiness checks from the
external actions that require Stripe Dashboard and deployment access.

Do not paste Stripe secrets, customer PII, raw card details, or full webhook
payloads into GitHub issues or PRs.

## Current cutover blockers

Resolve these product/deployment decisions before final production cutover:

1. Confirm the public tier names, limits, and monthly prices before creating
   Stripe Products/Prices or updating `plans` rows.
2. Confirm whether hosted billing starts with no trial or a 14-day Pro trial.
3. Confirm org-level billing remains the intended account model.
4. Confirm hard-cap quota gating is acceptable; the current implementation
   blocks over-quota sends instead of grace or metered overage.

Until those decisions are final, use test-mode Stripe Products/Prices and test
plan rows only.

## Environment matrix

`BILLING_BACKEND` stays unset or `disabled` for local/self-host OSS deploys. The
hosted app and hosted ingester must both be switched to `stripe` from the secret
manager/runtime configuration, never by committing secrets.

| Service | Required hosted billing env | Notes |
| --- | --- | --- |
| App / dashboard / REST API | `BILLING_BACKEND=stripe`, `STRIPE_SECRET_KEY` | Enables billing pages and `/api/billing/*` checkout/portal routes. |
| Ingester | `BILLING_BACKEND=stripe`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Receives Stripe events at `POST /webhooks/stripe`; `STRIPE_WEBHOOK_SECRET` must match that endpoint's signing secret. |
| Migrator | `DATABASE_URL` | Run migrations before deploying code that expects billing tables/columns. No Stripe secret is needed for migrations. |

Optional hosted billing env:

- `BILLING_NOTIFICATION_FROM_EMAIL` on the ingester to send payment-failed
  notifications.
- `NEXT_PUBLIC_APP_URL` / `BETTER_AUTH_URL` on the app so Stripe returns to the
  correct hosted URL after Checkout or Customer Portal.

Docker Compose now passes the billing env names through to `app` and `ingester`
with empty/disabled defaults, so self-host defaults remain unmetered.

## Preflight checks

Run the repo-owned preflight without printing secrets:

```bash
bun run billing:preflight -- --service all
```

Expected before hosted cutover: errors if `BILLING_BACKEND=stripe`,
`STRIPE_SECRET_KEY`, or the ingester `STRIPE_WEBHOOK_SECRET` are not present in
the current environment.

After pointing `DATABASE_URL` at staging/prod, also validate public plan mapping:

```bash
bun run billing:preflight -- --service all --check-db --strict
```

The DB check verifies:

- public paid plans have a non-empty `plans.stripe_price_id`,
- each paid public plan uses a `price_...` Stripe Price ID shape,
- duplicate public plan Price IDs are rejected,
- Free plan rows do not require Checkout.

A warning that no paid public plans exist means Checkout cannot be validated yet;
seed approved paid tiers first.

## Stripe Products and Prices mapping

Create Products/Prices in Stripe test mode first, then repeat in live mode after
staging evidence passes.

1. In Stripe Dashboard, create one Product per approved public paid tier.
2. Create one recurring monthly Price per tier. Keep currency/amount aligned
   with the approved public pricing decision.
3. Record only Price IDs (`price_...`) in deployment notes; do not record API
   keys or customer/payment details.
4. Update `plans.stripe_price_id` for the matching paid public `plans.slug` rows.
5. Run `bun run billing:preflight -- --check-db --strict` against the hosted DB.

Example SQL shape; replace placeholders only after Jaeyun confirms tier names and
prices:

```sql
update plans set stripe_price_id = 'price_REPLACE_WITH_TEST_OR_LIVE_ID'
where slug = 'REPLACE_WITH_APPROVED_PLAN_SLUG';
```

If using the Stripe CLI for an operator-side sanity check, list active prices
without exposing secrets:

```bash
stripe prices list --active=true --expand data.product
```

## Hosted validation checklist

Record exact hosted URLs, Stripe event IDs, and DB row evidence in the issue/PR.
Do not include secrets, PII, card numbers, or raw payment details.

### 1. Free signup and billing page

1. Open the hosted app URL with `BILLING_BACKEND=stripe` enabled.
2. Sign up with a fresh test user/org.
3. Confirm dashboard load succeeds.
4. Open `/settings/billing` and confirm it renders without Stripe env errors.
5. DB evidence to capture:

```sql
select id, slug, name, monthly_price_cents, monthly_email_quota, stripe_price_id
from plans
where is_public = true
order by monthly_price_cents;

select user_id, plan_id, status, stripe_subscription_id, current_period_start, current_period_end
from subscriptions
where user_id = '<redacted_user_id>';
```

### 2. Checkout upgrade return

1. From `/settings/billing` or `/pricing`, choose the approved paid plan.
2. Confirm the app creates a Stripe Checkout Session and redirects to Stripe.
3. Complete test-mode payment with Stripe test card details in Stripe-hosted UI.
4. Confirm the browser returns to:

```text
/settings/billing?status=success
```

5. Record the Checkout Session ID and resulting Stripe event IDs, not card data.

### 3. Webhook subscription update

Stripe endpoint target:

```text
https://<hosted-ingester-host>/webhooks/stripe
```

After Checkout, verify ingester logs include `stripe.webhook.processed` for the
relevant event IDs. Then capture DB evidence:

```sql
select stripe_event_id, event_type, processed_at
from stripe_events_processed
order by processed_at desc
limit 10;

select user_id, plan_id, status, stripe_customer_id, stripe_subscription_id,
       current_period_start, current_period_end
from subscriptions
where user_id = '<redacted_user_id>';
```

Replay a Stripe event from Dashboard if needed: **Developers → Events → select
event → Resend**, targeting the hosted ingester webhook endpoint. Replays should
log `stripe.webhook.duplicate` after the first successful processing.

### 4. Customer Portal return

1. Click **Manage billing** on `/settings/billing`.
2. Confirm the app opens Stripe Customer Portal.
3. Return from Stripe and confirm the app lands back on `/settings/billing`.
4. Confirm no 4xx/5xx errors in app logs for `POST /api/billing/portal`.

### 5. Quota-gating behavior

Validate both hosted metered and self-host/default-disabled behavior.

Hosted over-quota path:

1. Use a test account whose current plan has a low email quota or whose
   `usage_periods.emails_sent` has been set to the limit in staging/test data.
2. Send one email through the hosted API using a valid API key.
3. Confirm response status is `402` with structured `quota_exceeded` body.
4. Confirm no new downstream send job is queued for the rejected request.

Expected response shape includes:

```json
{
  "name": "quota_exceeded",
  "message": "Quota exceeded.",
  "statusCode": 402
}
```

Disabled/self-host path:

1. Run a local or self-host stack with `BILLING_BACKEND=disabled` or unset.
2. Send the same kind of email request.
3. Confirm quota checks are bypassed and no Stripe SDK calls are required.

## Evidence template for issue #297

```md
## Hosted Stripe cutover validation

- App URL exercised:
- Ingester URL exercised:
- Env preflight: pass/fail, command, timestamp:
- DB plan preflight: pass/fail, command, timestamp:
- Stripe mode: test/live
- Stripe Price IDs verified: price_... list, no secrets
- Free signup + billing page: pass/fail
- Checkout return: pass/fail, Checkout Session ID:
- Webhook processing: pass/fail, Stripe event IDs:
- Customer Portal return: pass/fail
- Quota exceeded 402: pass/fail
- Disabled billing bypass: pass/fail
- Blockers / residual risk:
```
