---
date: 2026-05-10
issue: "#303"
type: decision
promoted_to: null
---

## Automation run cancellation uses terminal status plus step-state metadata

**What:** Run cancellation is an additive API control that sets `automation_runs.status = cancelled`, `completed_at`, clears `next_step_at`, preserves `current_step_key`, and stores the operator reason in both `failure_reason` and the current step state's `output.cancellation_reason`.

**Why:** This avoids a schema migration while keeping run history intact and making cancelled queued/waiting runs terminal for cron/runner dispatch.

**Fix:** Future dashboard controls should treat `cancelled` as terminal history, not deletion, and should not requeue cancelled runs unless a new explicit retry/restart contract is designed.
