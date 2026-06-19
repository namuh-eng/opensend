---
date: 2026-06-19
issue: "#640"
type: decision
promoted_to: null
---

## DB polling fallback must be explicit and SQS-gated

**What:** Default self-host delivery now treats absent `BACKGROUND_JOBS_QUEUE_URL` as an explicit DB-polling fallback mode, with `BACKGROUND_JOBS_DB_POLLING_FALLBACK=false` as the opt-out/fail-fast switch.
**Why:** Returning success from `/api/emails` while no queue worker can ever see the row is worse than either dispatching locally or returning an actionable worker-configuration error.
**Fix:** Keep fallback polling in the ingester worker, gate it off whenever SQS is configured, and claim queued rows atomically before provider handoff so fallback and duplicate SQS jobs cannot double-send the same email.
