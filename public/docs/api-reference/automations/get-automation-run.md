# Get Automation Run

Retrieve one run for one automation.

This page documents the OpenSend-owned API contract for `GET /automations/{automation_id}/runs/{run_id}`.

`GET /automations/{automation_id}/runs/{run_id}`

## Authentication

Use a full-access OpenSend API key in the Authorization header. Dashboard session cookies are not API credentials for this root public API route.

```http
Authorization: Bearer os_YOUR_API_KEY
```

## Path parameters

- `automation_id` — tenant-scoped automation ID.
- `run_id` — automation run ID that must belong to the automation.

## Response

Run detail includes trigger/contact IDs when available, current step state, failure reason, timestamps, next scheduled step time, and a `step_states` object for debugging.

```json
{
  "object": "automation_run",
  "id": "run_123",
  "automation_id": "auto_123",
  "status": "waiting",
  "step_states": {}
}
```

## Errors

Missing automations, cross-tenant automations, and run IDs that do not belong to the automation return `404`.
