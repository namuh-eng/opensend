---
date: 2026-05-28
issue: g004-webhook-event-catalog
type: decision
promoted_to: null
---

# Webhook docs must use actual Svix-compatible headers

OpenSend dispatches webhook deliveries with `svix-id`, `svix-timestamp`, and `svix-signature`, signed over `<svix-id>.<svix-timestamp>.<raw-body>` with HMAC-SHA256. Do not document generic `webhook-id` style headers.

The supported subscription catalog comes from `packages/core/src/webhook-events.ts`. `email.received` is a reserved inbound contract only and is not currently accepted by webhook create/update validation unless the product implementation changes.
