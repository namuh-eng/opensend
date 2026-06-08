# Send Custom Event

Send a custom event into OpenSend. This page documents the OpenSend-owned API contract for `POST /api/events/send`.

`POST /api/events/send`

## Authentication

Use an OpenSend API key in the Authorization header. Dashboard session cookies are not API credentials for public API clients.

```http
Authorization: Bearer os_YOUR_API_KEY
```

## When to use it

Use this route to deliver a custom event for exactly one contact. Provide either `contact_id`/`contactId` or `email`, plus an optional `payload` object. If the event has a stored schema, OpenSend validates `payload` before recording the delivery or resuming automations.

## Parameters

JSON body fields are validated before any database write. The route accepts:

- `event` — custom event name.
- `contact_id` or `contactId` — contact ID to associate with the event.
- `email` — contact email to resolve instead of a contact ID.
- `payload` — optional object passed to automations and schema validation.

## Request example

```json
{
  "event": "user.signed_up",
  "email": "ada@example.com",
  "payload": { "plan": "pro" }
}
```

## Response

Successful responses return `202 Accepted` with the event delivery and any automation runs created or resumed:

```json
{
  "object": "event_delivery",
  "delivery": {
    "object": "event_delivery",
    "id": "2d66f2de-0d0e-4a2d-8e66-831e3522d124",
    "event": "user.signed_up",
    "contact_id": "520784e2-887d-4c25-b53c-4ad46ad38100",
    "email": "ada@example.com",
    "payload": { "plan": "pro" },
    "received_at": "2026-06-08T00:00:00.000Z"
  },
  "resumed_runs": [],
  "automation_runs": []
}
```

## Errors

OpenSend returns structured errors for missing authentication, invalid JSON, validation failures, schema mismatches, quota/rate-limit conditions, and unexpected server failures.

## Self-hosting notes

Self-hosted deployments can use the same path on their own `OPENSEND_BASE_URL`. Run migrations before deploying code that expects new fields, and keep API keys in a secrets manager instead of committing them to source control.
