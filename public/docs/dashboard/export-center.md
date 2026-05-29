# Dashboard Export Center

The Export Center creates dashboard-session CSV exports for stable OpenSend resources without widening the public API-key surface. It is intended for operational downloads from the authenticated dashboard, not server-to-server automation.

## Supported resources

The first production slice supports bounded CSV exports for:

- Emails
- Email events
- Contacts
- Segments
- Topics
- Suppressions
- Webhook deliveries
- API request logs
- Broadcasts
- Automation runs
- Domains
- API keys, with token previews only and no token hashes or raw secrets

Each resource has an explicit CSV schema version. Schema version `1` is used for the initial set of resources, and column changes should be treated as compatibility changes.

## Retention and authorization

Export jobs are tenant-scoped by `user_id` and record the creator, resource, filters, status, schema version, row count, byte size, expiry, and download count. Completed CSV content is retained for seven days. Download links are not public signed URLs; OpenSend checks the dashboard session and tenant ownership again when a user downloads the file.

Expired exports remain visible in history but cannot be downloaded. Create a new export if the data is still needed.

## Limits

This slice generates exports synchronously and stores the completed CSV in the application database. To keep self-hosted deployments predictable, each job is capped at 1,000 rows. If more rows match the filters, the job is recorded as failed and the user should refine filters.

This is not yet a background export pipeline. Large asynchronous jobs, object-storage-backed files, email delivery of download links, team role approvals, and exports for unstable/partial resources are intentionally not included in this slice.

## API shape

Dashboard routes require an authenticated browser session:

- `GET /api/dashboard/export-jobs` lists recent export jobs for the current tenant.
- `POST /api/dashboard/export-jobs` creates a bounded CSV export for a supported resource.
- `GET /api/dashboard/export-jobs/{id}` reads one export job if it belongs to the current tenant.
- `GET /api/dashboard/export-jobs/{id}/download` downloads the CSV if the job belongs to the current tenant, is complete, and has not expired.

The existing immediate CSV routes remain available for page-level export buttons, but new dashboard history/download workflows should use the Export Center job routes.
