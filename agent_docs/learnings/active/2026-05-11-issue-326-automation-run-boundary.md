---
date: 2026-05-11
issue: "#326"
type: decision
promoted_to: null
---

## Automation run read/cancel/metrics boundary keeps request parsing in Next

**What:** The automation run list/detail/cancel/metrics routes now delegate automation ownership checks, run lookup, cancellation metadata mutation, and metrics aggregation to `packages/core/src/services/automationRuns.ts`. Next route handlers still own API-key auth, full-access enforcement, JSON/query parsing, and HTTP status mapping.

**Why:** This preserves the existing public API contract and keeps Zod/Request parsing close to Next while making the tenant-scoped orchestration reusable for future adapters.

**Pattern:** For future automation run adapters, pass the already-authenticated `userId` and parsed query/body values into `createAutomationRunService()`. Keep cancellation guarded by both the pre-read status check and repository update condition so races continue to return `run_not_cancellable` instead of resurrecting terminal runs.
