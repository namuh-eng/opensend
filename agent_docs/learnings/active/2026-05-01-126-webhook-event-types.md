---
date: 2026-05-01
issue: 126
type: decision
promoted_to: null
---

# Webhook event type source of truth

Webhook subscriptions should use the fully-qualified event names emitted in webhook payloads, not raw internal email event names. The shared source of truth is `SUPPORTED_WEBHOOK_EVENT_TYPES` in `packages/core/src/webhook-events.ts`; API validation, dashboard rendering, and ingester dispatch matching should derive from that constant so unsupported names like `delivered`, `email.unknown`, or `*` do not silently drift.
