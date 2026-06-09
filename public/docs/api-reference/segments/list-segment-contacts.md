# List Segment Contacts

List contacts in a segment. This page documents the OpenSend-owned API contract for `GET /segments/{id}/contacts`.

`GET /segments/{id}/contacts`

## Authentication

Use an OpenSend API key in the Authorization header. Dashboard session cookies are not API credentials for public API clients.

```http
Authorization: Bearer os_YOUR_API_KEY
```

## When to use it

Use this route to page through contacts assigned to one tenant-scoped segment. It validates the segment belongs to the caller before returning contact rows.

## Parameters

- `id` — segment ID for the authenticated tenant.
- `limit` — optional page size.
- `after` — optional cursor from the previous page.

## Response

Successful responses return a paginated contact list for the segment:

```json
{
  "object": "list",
  "data": [
    {
      "id": "520784e2-887d-4c25-b53c-4ad46ad38100",
      "email": "ada@example.com",
      "firstName": "Ada",
      "lastName": "Lovelace",
      "unsubscribed": false,
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
