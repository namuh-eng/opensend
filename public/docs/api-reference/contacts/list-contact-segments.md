# List Contact Segments

List segments assigned to a contact. This page documents the OpenSend-owned API contract for `GET /contacts/{contact_id}/segments`.

`GET /contacts/{contact_id}/segments`

Compatibility note: `GET /api/contacts/{id}/segments` remains available for existing OpenSend integrations; new API clients should prefer the root compatibility path above.

## Authentication

Use an OpenSend API key in the Authorization header. Dashboard session cookies are not API credentials for public API clients.

```http
Authorization: Bearer os_YOUR_API_KEY
```

## When to use it

Use this route to inspect the segment memberships for one tenant-scoped contact. It does not create, update, or delete contact data.

## Parameters

- `contact_id` — contact ID or email for the authenticated tenant.

## Response

Successful responses return the contact's segment memberships:

```json
{
  "object": "list",
  "data": [
    {
      "id": "78261eea-8f8b-4381-83c6-79fa7120f1cf",
      "name": "Newsletter Subscribers",
      "created_at": "2026-06-08T00:00:00.000Z"
    }
  ],
  "has_more": false
}
```

## Errors

OpenSend returns structured errors for missing authentication, validation failures, not-found resources, quota/rate-limit conditions, and unexpected server failures. Treat `404` as either missing or not owned by the caller.

## Self-hosting notes

Self-hosted deployments can use the same path on their own `OPENSEND_BASE_URL`. Run migrations before deploying code that expects new fields, and keep API keys in a secrets manager instead of committing them to source control.
