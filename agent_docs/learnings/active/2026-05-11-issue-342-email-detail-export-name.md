---
date: 2026-05-11
issue: "#342"
type: mistake
promoted_to: null
---

## Avoid core export name collisions with DTO aliases

Issue #342 added an email detail service under `packages/core/src/services/`. Exporting a type named `EmailDetailResponse` collided with the existing `packages/core/src/dto` export of the same name when `packages/core/src/index.ts` re-exported the service.

Service-boundary DTOs that overlap public SDK/API DTO names should use service-scoped names such as `EmailDetailServiceResponse`, or the barrel export will fail TypeScript with duplicate star-export ambiguity.
