# Export Suppressions

Export tenant-scoped suppressions as sanitized CSV.

`GET /api/suppressions/export`

## Authentication

Use a full-access OpenSend API key for public API clients. The dashboard also exposes CSV export from the Suppressions page using the authenticated session.

```http
Authorization: Bearer os_YOUR_API_KEY
```

## Query parameters

The export endpoint supports the same filters as `GET /api/suppressions`: `q`, `reason`, `source`, `created_after`, `created_before`, `domain`, and `topic_id`.

## Limits and safety

Exports are immediate and bounded to 1,000 rows. If more rows match, OpenSend returns `413 export_too_large` and asks you to refine filters. CSV cells that could be interpreted as spreadsheet formulas are prefixed with an apostrophe before download.

## CSV columns

`id,email,reason,source,source_email_id,source_message_id,suppressed_at,updated_at`

Only rows owned by the authenticated tenant are exported.
