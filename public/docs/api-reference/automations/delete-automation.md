# Delete Automation

Delete a disabled automation.

This page documents the OpenSend-owned API contract for `DELETE /automations/{automation_id}`.

`DELETE /automations/{automation_id}`

## Authentication

Use a full-access OpenSend API key in the Authorization header. Dashboard session cookies are not API credentials for this root public API route.

```http
Authorization: Bearer os_YOUR_API_KEY
```

## Behavior

Only disabled automations can be deleted. Stop or patch the automation to `disabled` first, then delete it. Deletes remove the automation and its step/run rows through database cascade behavior.

## Response

```json
{
  "object": "automation",
  "id": "auto_123",
  "deleted": true
}
```

## Errors

Enabled automations return `409` with code `automation_enabled`. Missing or cross-tenant automations return `404`.
