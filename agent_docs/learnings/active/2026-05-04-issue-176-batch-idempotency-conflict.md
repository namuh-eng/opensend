---
date: 2026-05-04
issue: 176
type: decision
promoted_to: null
---

# Batch idempotency preserves the existing conflict contract

For issue #176, batch send idempotency uses the existing `emails.idempotency_key` unique column by persisting the request key only on the first accepted row in a batch. Retries precheck that key before body persistence, quota reservation, or queue publishing and return the same public `409 idempotency_conflict` shape used by single send, with `details.id` set to the first accepted row id.

This avoids a schema migration and avoids colliding with the per-row unique index. If future product requirements need replaying every accepted batch id, add a request-level idempotency store instead of forcing the same key onto every email row.
