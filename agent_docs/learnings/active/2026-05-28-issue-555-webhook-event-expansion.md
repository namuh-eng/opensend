---
date: 2026-05-28
issue: 555
type: decision
promoted_to: null
---

# Webhook event expansion remains transition-gated

Issue #555 added only `email.scheduled`, `email.delayed`, and `email.suppressed` to `SUPPORTED_WEBHOOK_EVENT_TYPES` because those have concrete lifecycle transitions in the current codebase: future send acceptance, provider retry delay, and suppression-policy rejection. `email.received` and forwarding events remain reserved/undocumented as subscribeable until inbound MIME ingestion or forwarding runtime paths create durable events.

For email-owned app transitions, persist raw `email_events.type` values without the `email.` prefix and match subscriptions against the public `email.*` event name. This keeps email timelines consistent with SES/tracking rows while preserving the dispatcher/catalog source of truth.
