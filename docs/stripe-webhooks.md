# Stripe webhook runbook

OpenSend processes Stripe subscription and invoice lifecycle events on the
ingester service at `POST /webhooks/stripe`. Hosted cutover details live in
[`hosted-stripe-cutover.md`](hosted-stripe-cutover.md).

Required ingester env for hosted Stripe webhooks:

```bash
BILLING_BACKEND=stripe
STRIPE_SECRET_KEY=<from-secret-manager>
STRIPE_WEBHOOK_SECRET=<stripe-webhook-signing-secret>
```

Run the non-secret preflight before pointing Stripe at the endpoint:

```bash
bun run billing:preflight -- --service ingester
```

## Replay an event from Stripe

1. In the Stripe Dashboard, open **Developers → Webhooks**.
2. Select the OpenSend ingester webhook endpoint.
3. Open the failed or historical event.
4. Choose **Resend**.
5. Confirm the resend target is the ingester webhook endpoint.
6. Check ingester logs for `stripe.webhook.processed`, `stripe.webhook.duplicate`,
   or `stripe.webhook.signature_failed`.

Replays are safe: processed event ids are stored in
`stripe_events_processed`, so Stripe retries or manual resends do not reapply
subscription side effects.
