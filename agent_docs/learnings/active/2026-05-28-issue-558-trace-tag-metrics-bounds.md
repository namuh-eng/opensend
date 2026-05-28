---
date: 2026-05-28
issue: "#558"
type: decision
promoted_to: null
---

## Bound tag metrics to safe dashboard windows

**What:** Tag-filtered metrics and tag breakdowns stay inside the existing dashboard date presets and cap tag option/breakdown source rows instead of scanning a tenant's full email history.

**Why:** Email tags are JSONB compatibility metadata, not a warehouse dimension table. The safe staging slice should use tenant/date predicates plus GIN indexes and explicit row/entry limits before considering a dedicated aggregate table.

**Fix:** Keep tag predicates centralized with send-tag validation semantics, require tenant predicates on every tag query, and add relational/tag indexes before widening metrics surfaces.
