---
date: 2026-05-28
issue: 557
type: decision
promoted_to: null
---

# Export Center first slice uses bounded durable database storage

Issue #557 implements the first unified dashboard Export Center without introducing a background worker or object-storage delivery path. Export jobs are dashboard-session-only, tenant-scoped, schema-versioned CSV records stored in `dashboard_export_jobs` with creator metadata, filters, row/byte counts, seven-day expiry, and download counters.

The slice remains bounded at 1,000 rows and stores completed CSV content in Postgres. Over-cap jobs are recorded as failed so history stays honest. Future async/object-storage/email delivery work should reuse the job metadata and download authorization checks instead of widening the public API-key surface.
