---
date: 2026-05-10
issue: "#320"
type: pattern
promoted_to: null
---

## Broadcast CRUD keeps auth and HTTP mapping in Next while core owns tenant-scoped orchestration

Broadcast create/list/detail/update/delete now route through `packages/core/src/services/broadcast.ts`, with Next adapters limited to auth resolution, request/query parsing, service invocation, and status/body mapping.

The reusable boundary should keep tenant scope in every repository method (`findByIdForUser`, `listForApi`, `updateForUser`, `deleteForUser`) instead of accepting unscoped CRUD calls from adapters. Preserve send and metrics as separate slices because they own fanout/status-transition and aggregation/cache behavior beyond CRUD.
