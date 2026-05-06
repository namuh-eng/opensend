---
date: 2026-05-06
issue: "#218"
type: decision
promoted_to: null
---

## Lifecycle webhook events use nullable email_events.email_id

Contact/domain lifecycle webhooks reuse the existing `email_events` + `webhook_deliveries` dispatcher path instead of adding a parallel event table. `email_events.email_id` is nullable for non-email lifecycle rows and `email_events.user_id` scopes event enqueue to active webhook subscriptions owned by the same tenant.

Why: the dispatcher already loads deliveries by event id and serializes `{ id, type, created_at, data }`; making the event store generic enough for contact/domain payloads preserves email delivery behavior while replacing the old console-only `queueEvent` path with real pending delivery rows.
