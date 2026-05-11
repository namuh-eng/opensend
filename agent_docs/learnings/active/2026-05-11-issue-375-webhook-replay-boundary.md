---
date: 2026-05-11
issue: "#375"
type: decision
promoted_to: null
---

## Webhook replay should create a new delivery row, then reuse dispatcher signing

Dashboard replay stays tenant-safe by resolving the caller-owned webhook before reading the original delivery. A replay does not mutate the old delivery or reuse its Svix message id; it creates a new pending `webhook_deliveries` row with the same `event_id` and `webhook_id`, then dispatches that new id through the existing webhook dispatcher so endpoint URL, event payload, and Svix-compatible signing stay on the same path as normal delivery.

Disabled endpoints are rejected before creating the replay row. Deleted or foreign endpoints are reported as not found before any delivery lookup to avoid leaking cross-tenant delivery existence.
