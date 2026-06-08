# List Events

List custom events configured for automations. This page documents the OpenSend-owned API contract for `GET /api/events`.

`GET /api/events`

## Authentication

Use an OpenSend API key in the Authorization header. Dashboard session cookies are not API credentials for public API clients.

```http
Authorization: Bearer os_YOUR_API_KEY
```

## When to use it

Use this route to inspect the custom event names and optional payload schemas that can trigger OpenSend automations for the authenticated tenant.

## Parameters

`limit` and `after` may be used for cursor pagination.

## Response

Successful responses return a tenant-scoped list of custom event definitions:

```json
{
  "object": "list",
  "data": [
    {
      "object": "event",
      "id": "41f2a3a9-6cb2-4c94-9ec6-f9be3f0ee4e8",
      "name": "user.signed_up",
      "schema": {
        "properties": {
          "plan": { "type": "string" }
        }
      },
      "created_at": "2026-06-08T00:00:00.000Z",
      "updated_at": "2026-06-08T00:00:00.000Z"
    }
  ],
  "has_more": false
}
```

## Errors

OpenSend returns structured errors for missing authentication, validation failures, not-found resources, quota/rate-limit conditions, and unexpected server failures.

## Self-hosting notes

Self-hosted deployments can use the same path on their own `OPENSEND_BASE_URL`. Run migrations before deploying code that expects new fields, and keep API keys in a secrets manager instead of committing them to source control.
