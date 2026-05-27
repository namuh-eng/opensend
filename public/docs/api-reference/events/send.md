# Send Custom Event

Send a custom event into OpenSend. This page documents the OpenSend-owned API contract for `POST /api/events/send`.

`POST /api/events/send`

## Authentication

Use an OpenSend API key in the Authorization header. Dashboard session cookies are not API credentials for public API clients.

```http
Authorization: Bearer os_YOUR_API_KEY
```

## When to use it

Event routes expose OpenSend automation events. Use them to inspect or send custom events that can trigger automations when your workspace has matching triggers configured. Trigger delivery for an already-created resource. The route validates ownership and current state before queueing work.

## Parameters

Path parameters identify the tenant-scoped resource. JSON body fields are validated by the route before any database write.

## Request example

```json
{
  "event": "user.signed_up",
  "email": "ada@example.com",
  "properties": { "plan": "pro" }
}
```

## Response

Successful responses return JSON scoped to the authenticated tenant. A representative response shape is:

```json
{
  "data": [
    { "id": "event_123", "type": "user.signed_up" }
  ],
  "hasMore": false
}
```

## Errors

OpenSend returns structured errors for missing authentication, validation failures, not-found resources, quota/rate-limit conditions, and unexpected server failures. Treat `404` as either missing or not owned by the caller.

## Self-hosting notes

Self-hosted deployments can use the same path on their own `OPENSEND_BASE_URL`. Run migrations before deploying code that expects new fields, and keep API keys in a secrets manager instead of committing them to source control.
