# List Automation Runs

List runs for one automation.

This page documents the OpenSend-owned API contract for `GET /automations/{automation_id}/runs`.

`GET /automations/{automation_id}/runs`

## Authentication

Use a full-access OpenSend API key in the Authorization header. Dashboard session cookies are not API credentials for this root public API route.

```http
Authorization: Bearer os_YOUR_API_KEY
```

## Parameters

- `automation_id` — tenant-scoped automation ID.
- `limit` — optional page size from 1 to 100.
- `after` — optional cursor.
- `status` — optional run status filter; comma-separated statuses are accepted.

## Response

```json
{
  "object": "list",
  "data": [
    {
      "object": "automation_run",
      "id": "run_123",
      "automation_id": "auto_123",
      "status": "waiting",
      "current_step_key": "wait"
    }
  ],
  "has_more": false
}
```

## Errors

A missing or cross-tenant automation returns `404`. Runs are always filtered through the tenant-scoped automation lookup first.
