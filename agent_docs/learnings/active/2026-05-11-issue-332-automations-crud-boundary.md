---
date: 2026-05-11
issue: "#332"
type: pattern
promoted_to: null
---

## Automation CRUD routes keep HTTP/auth/Zod in Next while core owns orchestration and response DTOs

Public automation create/list/detail/update/delete now route through `packages/core/src/services/automations.ts`. The Next adapters still own API-key auth, full-access gating, JSON/query parsing, Zod error envelopes, and HTTP status mapping; the core service owns tenant-scoped lookup/list orchestration, step replacement transactions, connection validation handoff, list enrichment, delete preconditions, and public automation response formatting.

Preserve the existing split for future adapters: pass the authenticated `userId` and already-parsed request data into `createAutomationService()`. Do not move automation run routes or custom event ingestion into this CRUD boundary; runs remain in `automationRuns.ts` and event ingestion remains separate.
