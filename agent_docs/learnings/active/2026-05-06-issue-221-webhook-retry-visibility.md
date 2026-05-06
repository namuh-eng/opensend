---
date: 2026-05-06
issue: "#221"
type: decision
promoted_to: null
---

## Webhook retry visibility belongs on webhook detail DTOs

Issue #221 only needed retry schedule parity, but Resend's operator expectation includes seeing the next retry time on message/delivery detail. OpenSend already persisted `webhook_deliveries.next_retry_at`; expose a bounded recent-delivery list from webhook detail rather than adding replay UI, scheduler architecture, or a separate message-detail surface.

Keep this path tenant-safe by resolving the webhook through the caller-owned webhook service first, then listing deliveries for that verified webhook id.
