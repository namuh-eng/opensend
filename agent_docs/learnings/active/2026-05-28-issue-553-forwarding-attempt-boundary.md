---
date: 2026-05-28
issue: 553
type: decision
promoted_to: null
---

## Inbound forwarding uses the outbound email row as the provider boundary

Issue #553 records forwarding attempts immediately after inbound storage commits. The attempt links the received email, forwarding rule, destinations, and the queued outbound `emails` row created by the existing send queue boundary.

This keeps inbound ingestion durable: disabled, invalid, loop-blocked, or send-boundary failures create visible `forwarding_attempts` rows without deleting or hiding the original `received_emails` row. Provider message IDs remain nullable because the current send worker does not persist provider IDs back to a separate forwarding table after delivery; the forwarded email status remains the source of truth for provider retry/failure lifecycle.
