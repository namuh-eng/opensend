---
date: 2026-05-11
issue: "#328"
type: pattern
promoted_to: null
---

## Public logs read APIs now use a core service boundary

Issue #328 extracted `GET /api/logs` and `GET /api/logs/[id]` into `packages/core/src/services/logs.ts`, with `logRepo.listForApi` / `findByIdForUser` owning persistence, filters, cursor ordering, and tenant predicates. The Next adapters should stay limited to API-key auth, full-access permission checks, URL/param extraction, and HTTP error mapping.

The core schema must mirror app schema for log fields such as `apiKeyId`; missing schema parity can make the service extraction typecheck fail even when the app route previously compiled against `src/lib/db/schema.ts`.
