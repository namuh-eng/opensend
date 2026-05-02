# Stripe webhook runbook

OpenSend processes Stripe subscription and invoice lifecycle events on the
ingester service at `POST /webhooks/stripe`.

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
