---
date: 2026-05-03
issue: "#120/#167"
type: decision
promoted_to: null
---

## Wait-for-event uses JSON run state and fails deterministically on timeout

**What:** `wait_for_event` stores its waiting metadata and matched event output in `automation_runs.step_states`; no new wait table was added for this backend slice. The first tick marks the step `waiting` and sets `next_step_at` only when `timeout_seconds` is configured. A matching `/api/events/send` for the same tenant/contact completes the waiting step and queues the next step; a due timeout fails the step/run with a deterministic timeout error.

**Why:** Issue #167 prioritizes preserving the one-step-per-tick runner contract and avoiding schema expansion unless JSON state is insufficient. The current bounded lookup scans waiting runs for the contact/user and keeps event routes non-sleeping while still proving resume semantics.

**Fix:** Add an indexed wait table only if production matching volume or race/idempotency requirements exceed the bounded JSON-state lookup.
