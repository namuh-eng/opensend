# Stop Automation

Stop an automation by disabling it.

This page documents the OpenSend-owned API contract for `POST /automations/{automation_id}/stop`.

`POST /automations/{automation_id}/stop`

## Authentication

Use a full-access OpenSend API key in the Authorization header. Dashboard session cookies are not API credentials for this root public API route.

```http
Authorization: Bearer os_YOUR_API_KEY
```

## Deterministic behavior

Stop is idempotent: OpenSend sets the tenant-scoped automation `status` to `disabled` and returns the automation detail. Calling stop again returns the same disabled automation. This route prevents new enabled-trigger runs, but it does not cancel existing queued, waiting, or running automation runs. Use the existing run cancellation route when you need to cancel a specific run.

## Response

```json
{
  "object": "automation",
  "id": "auto_123",
  "status": "disabled"
}
```

## Errors

A missing or cross-tenant automation returns `404`. Missing or insufficient API keys return authentication or permission errors before any state changes.
