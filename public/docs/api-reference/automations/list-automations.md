# List Automations

List automations for the authenticated tenant.

This page documents the OpenSend-owned API contract for `GET /automations`.

`GET /automations`

## Authentication

Use a full-access OpenSend API key in the Authorization header. Dashboard session cookies are not API credentials for this root public API route.

```http
Authorization: Bearer os_YOUR_API_KEY
```

## When to use it

Use this route to inspect automations that can react to custom events and drive lifecycle messaging. Results are tenant-scoped and include dashboard-friendly summary fields such as step count and last run summary when available.

## Parameters

- `limit` — optional page size from 1 to 100.
- `after` — optional cursor.
- `status` — optional `draft`, `enabled`, or `disabled` filter.
- `search` — optional name search string.

## Response

```json
{
  "object": "list",
  "data": [
    {
      "object": "automation",
      "id": "auto_123",
      "name": "Welcome flow",
      "status": "enabled",
      "trigger_event_name": "user.signed_up",
      "step_count": 3,
      "last_run": null
    }
  ],
  "has_more": false
}
```

## Errors

Missing, malformed, or insufficient API keys fail before tenant data is loaded. A resource from another tenant is never included in the list.
