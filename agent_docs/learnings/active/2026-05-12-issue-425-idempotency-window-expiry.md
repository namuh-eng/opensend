---
date: 2026-05-12
issue: "#425"
type: decision
promoted_to: null
---

## Expire scoped email idempotency keys in place after the 24-hour replay window

**What:** Single and batch send idempotency lookups are limited to rows whose `emails.created_at` is within the last 24 hours. When a keyed request has no in-window match, the handlers clear older matching `(user_id, idempotency_key)` rows before inserting the fresh keyed row.

**Why:** The existing `(user_id, idempotency_key)` unique index is still valuable for tenant-scoped duplicate protection inside the replay window, but it would otherwise reject Resend-compatible key reuse after 24 hours. Clearing only expired scoped keys keeps the scope tight and avoids adding a request-level idempotency table for this leaf issue.

**Fix:** If future requirements need full historical idempotency-key audit or richer request-body mismatch detection, add a dedicated request-level idempotency store instead of overloading `emails.idempotency_key` further.
