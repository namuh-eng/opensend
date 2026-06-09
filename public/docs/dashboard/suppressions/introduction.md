# Dashboard Suppressions

The Suppressions dashboard is the dedicated operational surface for addresses OpenSend will not send to for the current tenant. It is separate from Audience contacts and topic preferences so support teams can manage delivery-safety records without confusing them with marketing subscription state.

## What you can do

- List tenant-scoped suppressions.
- Search by email or source identifiers.
- Filter by reason, source, suppression date, and source email domain/topic where the current data model has that evidence.
- Add one manual suppression.
- Delete one suppression after an irreversible-action confirmation.
- Import a bounded CSV of up to 200 rows.
- Export the current filtered view as sanitized CSV up to 1,000 rows.

## Bulk import format

Use CSV with an `email` header and optional `reason` header:

```csv
email,reason
bounced@example.com,bounced
manual-hold@example.com,manual
```

If any row is malformed, OpenSend rejects the import and shows row-level feedback. No partial writes occur for malformed files.

## Domain and topic filters

Suppression rows created from SES/provider events can reference a source email. Domain and topic filters use that source email record. Manual dashboard/API/import suppressions do not currently store independent domain or topic dimensions, so those rows do not match domain/topic filters unless they are linked to a source email.

## Email and log detail visibility

Email detail shows suppression guidance when the primary recipient currently has a tenant-owned suppression row. OpenSend does not invent provider evidence for manual rows; logs and email detail only show suppression effects that exist in the current email, event, log, or suppression data.

## Self-hosted behavior

Self-hosted deployments use the same dashboard and API endpoints after migrations are applied. The import/export slice is synchronous and bounded; build a separate async job pipeline if your deployment needs durable exports beyond these limits.
