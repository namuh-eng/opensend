---
date: 2026-05-10
issue: 286
type: decision
promoted_to: null
---

## Domain verification reconciliation needs both endpoint parity and scheduler wiring on staging

Issue #286 assumed PR #275's `/jobs/domain-verify` path was already present, but the `staging` base for this worktree did not contain that merge. The fix therefore had to restore the shared domain reconciliation service and ingester job endpoint before adding scheduler wiring.

Pattern: when an issue references a recently merged PR, verify the target base branch directly before treating the referenced code as available. If the deploy target lacks the endpoint, ship the endpoint and scheduler together so production cannot have a durable schedule pointing at a missing route.

The Compose scheduler uses HTTP for `/jobs/domain-verify` even when scheduled email and webhook scans are queue-driven, because domain verification currently has no SQS scan job type.
