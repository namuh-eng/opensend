---
date: 2026-05-07
issue: "#240"
type: decision
promoted_to: null
---

## Keep scheduled_at natural language intentionally narrow

**What:** Issue #240 accepts `scheduled_at` as either a future ISO 8601 date-time with an explicit timezone or the narrow Resend-compatible form `in <positive integer> <minute|min|minutes|hour|hours|day|days>`, capped at 30 days.

**Why:** Resend compatibility needs the common scheduled-send shorthand, but accepting broad natural language would make validation nondeterministic and expand the public API contract. A shared parser in `src/lib/validation/emails.ts` keeps single send, batch send, and reschedule behavior aligned before rows are inserted or updated.

**Pattern:** Add new scheduled-send formats to the shared parser and tests first; do not parse route-local strings with `new Date(...)` directly.
