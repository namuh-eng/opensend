---
date: 2026-05-12
issue: "#424"
type: decision
promoted_to: null
---

## Batch idempotency replay stores the accepted response on the keyed row

**What:** Batch send replay now stores the original `{ data: [...] }` response envelope under `emails.document.idempotency` on the first accepted row that carries the request `Idempotency-Key`.

**Why:** The existing unique key is scoped as `(user_id, idempotency_key)` and only one row in a batch can carry the key. Storing the response on that anchor row avoids a new request-level idempotency table while still replaying every accepted batch id before quota, row, or queue side effects on retry.

**Fix:** If future work needs 24-hour expiry or richer mismatch detection, prefer extracting this into a dedicated request-level idempotency store rather than adding more batch-only state to individual email rows.
