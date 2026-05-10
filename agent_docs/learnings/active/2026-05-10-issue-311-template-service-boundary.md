---
date: 2026-05-10
issue: "#311"
type: pattern
promoted_to: null
---

## Template routes thin-adapter extraction

Issue #311 moved template create/list/detail/update/delete/publish/duplicate business rules into `packages/core/src/services/template.ts` while keeping Next.js route files responsible for auth, request JSON/params, service calls, and HTTP response/status mapping.

The existing core template schema was missing `currentVersionId`, `publishedAt`, and `hasUnpublishedVersions`, so service/repository extraction required aligning `packages/core/src/db/schema.ts` before `templateRepo.listForApi` could preserve list response fields.

Preserve variable normalization behavior in the service layer, not route-local helpers, and keep route tests focused on adapter mapping while service tests lock normalization, automatic extraction, publish, duplicate, and not-found behavior.
