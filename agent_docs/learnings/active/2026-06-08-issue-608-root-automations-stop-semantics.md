---
date: 2026-06-08
issue: "#608"
type: decision
promoted_to: null
---

## Root automation stop disables the automation without cancelling existing runs

**What:** `POST /automations/:id/stop` is a root public API compatibility adapter that requires a full-access API key and idempotently sets the tenant-scoped automation status to `disabled`.

**Why:** OpenSend already has deterministic per-run cancellation at `/api/automations/:id/runs/:runId/cancel`; bulk-cancelling queued or waiting runs from an automation-level compatibility route would create hidden side effects and race semantics not present in the existing service boundary.

**Pattern:** Future automation root aliases should route through strict API-key-only public adapters, not dashboard-session `/api/automations/**` handlers. Document any compatibility semantics that intentionally differ from per-run cancellation.
