---
date: 2026-05-04
issue: "#178"
type: decision
promoted_to: null
---

## contact_update uses explicit fields plus separate properties

**What:** The backend `contact_update` step accepts `config.fields` for first-class contact fields (`email`, `first_name`, `last_name`, explicit `unsubscribed`) and `config.properties` for custom property updates. Reserved/compliance-sensitive keys are rejected from `properties` so generic property merging cannot accidentally mutate unsubscribe status, topics, segments, or identity fields.

**Why:** Issue #178 requires safe contact mutation semantics and minimal output. Keeping first-class fields separate from custom properties preserves unspecified fields and makes compliance-sensitive updates explicit.

**Fix:** Future contact mutation slices should keep destructive/compliance-sensitive fields out of generic property maps and should output changed field names only, not full contact or payload dumps.
