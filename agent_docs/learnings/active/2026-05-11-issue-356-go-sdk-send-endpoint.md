---
date: 2026-05-11
issue: 356
type: decision
promoted_to: null
---

## Go SDK first send slice uses the Resend-compatible root endpoint

**What:** The first-party Go client SDK posts send requests to `POST /emails` from a separate `packages/go-sdk` module.
**Why:** The existing TypeScript and Python SDKs already target the Resend-compatible root send alias, while `services/api` owns the shared Hono route and Next.js keeps `/api/emails` as the compatibility adapter. Matching the published SDK shape avoids making Go callers special-case the Next.js adapter path.
**Boundary:** Keep `services/ingester-go` shadow-only and unrelated to client SDK packaging; do not wire it into Compose or reuse it for SDK code.
