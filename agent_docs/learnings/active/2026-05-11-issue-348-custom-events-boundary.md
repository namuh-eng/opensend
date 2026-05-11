---
date: 2026-05-11
issue: "#348"
type: pattern
promoted_to: null
---

## Custom event API boundary keeps transport validation in Next and injects wait-run resume

Custom event create/list/delete/send orchestration now lives in `packages/core/src/services/customEvents.ts`. Next routes still own API-key auth, full-access gating, JSON/Zod parsing, and HTTP status/error mapping. The service owns response DTOs, tenant-scoped event repository calls, stored schema payload validation, contact resolution/upsert, delivery recording, wait-for-event resume handoff, and automation trigger fan-out.

`resumeWaitingRunsForEvent` remains implemented in the app worker layer and is injected into `createCustomEventService()` from the Next send route. Preserve that dependency injection shape for future adapters instead of importing app worker code into `@opensend/core`.
