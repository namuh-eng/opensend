---
date: 2026-05-03
issue: "#71"
type: pattern
promoted_to: null
---

## Domains thin-adapter follow-up

**What:** `POST/GET /api/domains` now delegate create/list business logic to `packages/core/src/services/domain.ts` through `createDomainService(...)`; the Next.js route remains responsible for API-key auth, request JSON/Zod parsing, billing quota gate, and HTTP response/status mapping.

**Why:** Issue #71 is migrating reusable business logic toward `packages/core` before a Hono control-plane adapter. Domains needed a bounded extraction that preserved existing SES identity behavior and quota enforcement without coupling core to app-layer billing internals.

**Pattern:** Keep billing quota checks at the adapter boundary, inject app SES/cache dependencies into the core service, and test the service independently for lowercasing, default capabilities, SES DNS record construction, pagination normalization, and cache invalidation hooks.
