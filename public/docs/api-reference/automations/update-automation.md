# Update Automation

Update automation metadata, status, steps, or connections.

This page documents the OpenSend-owned API contract for `PATCH /automations/{automation_id}`.

`PATCH /automations/{automation_id}`

## Authentication

Use a full-access OpenSend API key in the Authorization header. Dashboard session cookies are not API credentials for this root public API route.

```http
Authorization: Bearer os_YOUR_API_KEY
```

## Request body

Send at least one updatable field: `name`, `status`, `trigger_event_name`, `steps`, or `connections`. If `steps` are supplied, OpenSend replaces the automation step graph after validating trigger and connection consistency.

```json
{
  "status": "disabled"
}
```

## Response

Successful updates return the automation detail after persistence. Status may be `draft`, `enabled`, or `disabled`.

## Errors

A missing or cross-tenant automation returns `404`. Invalid step graphs, unknown connections, and malformed status values return `422`.
