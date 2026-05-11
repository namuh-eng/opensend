---
date: 2026-05-11
issue: "#382"
type: decision
promoted_to: null
---

## Render open/click tracking at worker delivery time

**What:** Open/click tracking rewrites are applied in the queue worker immediately before provider delivery instead of mutating accepted email rows.
**Why:** The send API has already completed validation, template interpolation, and managed-unsubscribe rendering by the time rows are queued; rendering tracking at worker-time preserves stored body parity when tracking is disabled and also covers scheduled, batch, and broadcast sends that share the worker delivery path.
**Fix:** Future per-recipient tracking should preserve this provider-payload boundary unless the data model changes to store personalized rendered bodies intentionally.
