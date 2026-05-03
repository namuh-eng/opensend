---
date: 2026-05-04
issue: "#170"
type: decision
promoted_to: null
---

## Keep the first public error envelope at the send API boundary

**What:** Issue #170 adds a shared `src/lib/api-errors.ts` envelope and applies it to `POST /api/emails`, `POST /api/emails/batch`, quota failures, send-route rate-limit responses, and SDK parsing. The envelope carries `name`, `code`, `message`, `statusCode`, and sanitized optional `details`.

**Why:** Error codes are now a public API contract, but the first parity slice should avoid churn across dashboard/internal routes. Keeping the scope at send APIs preserves success response shapes and limits compatibility risk.

**Pattern:** Validation details should expose only `formErrors` and `fieldErrors`; auth errors distinguish missing/malformed/invalid bearer keys without echoing keys, token hashes, or raw validation payloads.
