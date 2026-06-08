# Create Automation

Create an automation for the authenticated tenant.

This page documents the OpenSend-owned API contract for `POST /automations`.

`POST /automations`

## Authentication

Use a full-access OpenSend API key in the Authorization header. Dashboard session cookies are not API credentials for this root public API route.

```http
Authorization: Bearer os_YOUR_API_KEY
```

## Request body

Send a JSON object with `steps` and optional `name`, `status`, `trigger_event_name`, and `connections`. The first step must be a `trigger`; OpenSend also accepts the existing OpenSend extension status `draft` in addition to `enabled` and `disabled`.

```json
{
  "name": "Welcome flow",
  "status": "enabled",
  "trigger_event_name": "user.signed_up",
  "steps": [
    {
      "key": "trigger",
      "type": "trigger",
      "config": { "event_name": "user.signed_up" },
      "position": 0
    },
    { "key": "end", "type": "end", "config": {}, "position": 1 }
  ],
  "connections": [{ "from": "trigger", "to": "end" }]
}
```

## Response

A successful create returns `201` and the automation detail, including normalized steps, connections, timestamps, and tenant-scoped ID.

## Errors

Validation failures return `422`. Missing or sending-only API keys return authentication or permission errors before any automation is created.
