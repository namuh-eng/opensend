# Get Automation

Retrieve one tenant-scoped automation.

This page documents the OpenSend-owned API contract for `GET /automations/{automation_id}`.

`GET /automations/{automation_id}`

## Authentication

Use a full-access OpenSend API key in the Authorization header. Dashboard session cookies are not API credentials for this root public API route.

```http
Authorization: Bearer os_YOUR_API_KEY
```

## Path parameters

- `automation_id` — the automation ID returned by create or list routes.

## Response

```json
{
  "object": "automation",
  "id": "auto_123",
  "name": "Welcome flow",
  "status": "enabled",
  "trigger_event_name": "user.signed_up",
  "connections": [{ "from": "trigger", "to": "end" }],
  "steps": [
    { "key": "trigger", "type": "trigger", "config": { "event_name": "user.signed_up" } }
  ]
}
```

## Errors

A missing or cross-tenant automation returns `404` instead of revealing ownership details. Validation and server errors use the standard OpenSend JSON error shape.
