---
date: 2026-05-11
issue: "#378"
type: decision
promoted_to: null
---

## Dashboard metric tag filters stay read-only over stored email tags

**What:** `/api/metrics` now treats `tag_name` plus optional `tag_value` as read-only filters over the existing `emails.tags` JSONB send contract, and the dashboard response exposes tenant-scoped tag options separately from the filtered aggregate rows.

**Why:** The issue only needs dashboard/API filtering parity. Changing send-time tag validation or ingestion would widen the contract and risk breaking existing Resend-compatible callers.

**Fix:** Future metric dimensions should flow through the dashboard aggregate service input/cache key and preserve tenant predicates in every aggregate query before adding UI controls.
