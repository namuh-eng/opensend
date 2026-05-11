---
date: 2026-05-11
issue: "#322"
type: decision
promoted_to: null
---

## Email read boundary preserves collection delete success semantics

Issue #322 moved public email list/detail/delete behavior into `packages/core/src/services/emailRead.ts`, with tenant scope enforced through `emailRepo.listForApi`, `findByIdForUser`, and `deleteForUser`.

The delete service intentionally returns `{ success: true }` after a scoped delete without first checking row existence because the existing `DELETE /api/emails?id=...` route did not 404 missing rows. Future detail-style delete routes can add explicit not-found behavior, but the collection query-param delete adapter should keep this legacy success response unless a public API change is planned.
