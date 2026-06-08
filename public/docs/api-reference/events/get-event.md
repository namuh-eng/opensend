# Get Event

Retrieve one custom event definition. This page documents the OpenSend-owned API contract for `GET /events/{identifier}`.

`GET /events/{identifier}`

## Authentication

Use an OpenSend API key in the Authorization header. Dashboard session cookies are not API credentials for public API clients.

```http
Authorization: Bearer os_YOUR_API_KEY
```

## Identifier

`identifier` may be either the event definition `id` or the exact event `name`. OpenSend resolves it inside the authenticated tenant only. If an identifier looks like a UUID, OpenSend checks event IDs first and then checks event names.

## Response

```json
{
  "object": "event",
  "id": "41f2a3a9-6cb2-4c94-9ec6-f9be3f0ee4e8",
  "name": "user.signed_up",
  "schema": null,
  "created_at": "2026-06-08T00:00:00.000Z",
  "updated_at": "2026-06-08T00:00:00.000Z"
}
```

## Errors

Cross-tenant or missing events return `404` without revealing whether the identifier exists for another tenant.
