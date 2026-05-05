---
date: 2026-05-05
issue: "#200"
type: decision
promoted_to: null
---

## Email API paths require authenticated user ownership

Email API key routes now treat `auth.userId` as mandatory and scope tenant-owned email list/detail/update/delete/event lookups by `emails.user_id`. Send and batch idempotency checks also include `emails.user_id`, and the email idempotency unique index is now `(user_id, idempotency_key)` so one tenant cannot receive another tenant's email id from a reused idempotency key.

This slice intentionally stays within emails/email-related surfaces. Broadcasts, webhooks/API keys, dashboard metrics/pages, cron/worker, and historical cleanup remain separate issue #200 follow-ups.
