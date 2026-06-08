# Webhook Storage and Replay

OpenSend stores webhook subscriptions, lifecycle events, and delivery attempts in Postgres so operators can inspect failures and replay eligible deliveries.

## Storage model

OpenSend uses three related records:

| Record | Purpose |
| --- | --- |
| `webhooks` | Tenant-owned endpoint URL, subscribed event types, status, and encrypted signing secret. |
| `email_events` | Durable lifecycle event payloads. Email events reference an email when one exists; contact, domain, and inbound events can also use the shared event pipeline. |
| `webhook_deliveries` | One delivery attempt stream per matching webhook/event pair, including status, attempts, response snippet, and retry timing. |

When an email lifecycle event is enqueued, OpenSend stores the event and creates pending deliveries for active webhooks owned by the same tenant whose `event_types` include that event.

## What is recorded for a delivery

Delivery records expose:

- `status`: `pending`, `success`, `failed`, or `dead_letter`.
- `attempt`: number of dispatch attempts already made.
- `status_code`: HTTP status from the endpoint when available.
- `response_body`: the first 1,000 characters of the endpoint response or error message.
- `attempted_at`: timestamp of the last attempt.
- `next_retry_at`: when a pending delivery is eligible for another dispatcher scan.

OpenSend signs each outgoing request with Svix-compatible headers: `svix-id`, `svix-timestamp`, and `svix-signature`.

## Retry behavior

The dispatcher treats any `2xx` response as success. Non-2xx responses, timeouts, network failures, unsafe URLs, disabled endpoints, or unsupported event types are recorded on the delivery row.

Default retry delays are 5 seconds, 5 minutes, 30 minutes, 2 hours, 5 hours, 10 hours, and 10 hours. After the final failed attempt, the delivery is marked `dead_letter`.

Self-hosted deployments must run the dispatcher/ingester worker for pending and retry-eligible deliveries to move forward. The app can create rows, but a stopped worker cannot deliver them.

## Replay behavior

Use the dashboard webhook detail page or `POST /api/webhooks/{id}/deliveries/{deliveryId}/replay` to replay a delivery. Replay creates a new `webhook_deliveries` row for the same event and webhook; it does not mutate the old delivery or reuse its message ID.

Replays require:

- The webhook must belong to the authenticated tenant.
- The original delivery must belong to that webhook.
- The webhook endpoint must still be active.

## Retention and privacy

OpenSend currently stores webhook event payloads and bounded response snippets in the application database. There is no separate public retention-control UI in this guide pack. Treat webhook payloads as operational records: avoid putting secrets in metadata, redact sensitive fields before sending custom events, and restrict database access in production.

## Related docs

- [Managing webhooks](../webhooks/introduction.md)
- [Event types](../webhooks/event-types.md)
- [Verify webhook requests](../webhooks/verify-webhooks-requests.md)
- [Retries and replays](../webhooks/retries-and-replays.md)
