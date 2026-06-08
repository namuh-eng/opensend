# Delete Event

Delete a custom event definition. This page documents the OpenSend-owned API contract for `DELETE /events/{identifier}`.

`DELETE /events/{identifier}`

Legacy OpenSend callers may continue to use `DELETE /api/events?id={id}`. The legacy collection delete form accepts only an event definition ID in the `id` query parameter.

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
  "deleted": true
}
```

## Errors

Cross-tenant or missing events return `404` without revealing whether the identifier exists for another tenant.
