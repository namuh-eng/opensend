# Import Suppressions

Import a bounded CSV of tenant-scoped suppressions.

`POST /api/suppressions/import`

## Authentication

Use a full-access OpenSend API key for public API clients. The dashboard uses the same handler with an authenticated dashboard session.

```http
Authorization: Bearer os_YOUR_API_KEY
Content-Type: text/csv
```

## CSV format

The first row must include an `email` header and may include `reason`.

```csv
email,reason
bounced@example.com,bounced
manual-hold@example.com,manual
```

Supported reasons are `manual`, `bounced`, and `complained`. Blank reasons default to `manual`.

## Limits and validation

This compatibility slice is intentionally synchronous and bounded:

- maximum 200 suppression rows per request
- maximum 64 KiB CSV body
- if any row is malformed, no rows are imported
- validation errors include row number, field, bad value when useful, and an actionable message

A larger asynchronous export/import center is tracked separately and is not part of this endpoint.

## Response

Successful imports return `201`:

```json
{
  "object": "suppression_import",
  "imported_count": 2,
  "rejected_count": 0,
  "limit": 200,
  "data": [],
  "errors": []
}
```

Malformed imports return `422` with row-level feedback.
