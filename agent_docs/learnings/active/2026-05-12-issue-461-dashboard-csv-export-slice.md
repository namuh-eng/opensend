---
date: 2026-05-12
issue: "#461"
type: decision
promoted_to: null
---

## Dashboard CSV export first slice stays immediate and capped

**What:** Issue #461's first implementation adds a shared dashboard-session CSV export boundary for the main dashboard resources and caps immediate downloads at 1,000 rows instead of adding export-record storage and email delivery in the same PR.

**Why:** The existing dashboard has no durable export storage or team role model yet. A capped immediate route closes the unsafe/no-op/client-only export gap without inventing a larger export platform or widening public API-key auth.

**Fix:** Keep exports session-authenticated and tenant-scoped, return `export_too_large` for over-cap results, and document durable 7-day export records/email delivery as the follow-up when storage/product surface is ready.
