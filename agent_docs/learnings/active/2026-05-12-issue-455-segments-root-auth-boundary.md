---
date: 2026-05-12
issue: 455
type: decision
promoted_to: null
---

# Root segments aliases stay API-key-only

Issue #455 adds Resend-compatible root `/segments` routes while preserving the older
`/api/segments` dashboard-compatible collection route for internal/dashboard callers.

Decision: root `/segments` collection routes call `validateApiKey` and
`requireFullAccessApiKey` directly instead of re-exporting `src/app/api/segments/route.ts`.
This prevents dashboard session cookies from becoming valid public API auth at the root
Resend-compatible surface. Detail aliases (`/segments/:id` and
`/segments/:id/contacts`) can re-export the existing `/api/segments/:id` handlers because
those handlers were already API-key-only and tenant-scoped through `auth.userId`.
