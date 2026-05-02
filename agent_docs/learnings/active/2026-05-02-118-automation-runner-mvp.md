---
date: 2026-05-02
issue: "#118"
type: decision
promoted_to: null
---

## MVP automation runner executes one due step per cron tick

**What:** The runner advances exactly one due step for each automation run per scheduled tick. Delay steps leave the run on the delay key with `status=waiting` and `next_step_at`; a later due tick completes the delay and advances to send.
**Why:** This matches the existing scheduled worker polling model and avoids sleeping or doing multi-step work inside event ingestion.
**Fix:** Future step types should preserve this one-step-per-tick contract and add their own waiting/resume state instead of blocking request or cron execution.
