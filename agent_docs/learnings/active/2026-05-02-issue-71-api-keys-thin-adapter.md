---
date: 2026-05-02
issue: "#71"
type: pattern
promoted_to: null
---

## API keys thin-adapter pilot

**What:** API key route handlers now delegate API-key business rules to `packages/core/src/services/apiKeys.ts` while staying responsible for auth, request parsing, and response mapping.

**Why:** Issue #71 needs proof that Next.js routes can become reusable adapters before moving behavior into `services/api`; API keys are low-risk because they avoid SES, Cloudflare, billing quota, and automation runner coupling.

**Pattern:** Extract service logic with injectable dependencies first, test it independently, then keep the route handler as `auth -> parse -> service call -> HTTP mapping` so a future Hono control-plane adapter can reuse the same service without preserving Next.js internals.
