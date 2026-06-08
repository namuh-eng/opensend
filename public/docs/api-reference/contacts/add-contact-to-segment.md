# Add Contact to Segment

Add an existing contact to an existing segment. This page documents the OpenSend-owned API contract for `POST /contacts/{contact_id}/segments/{segment_id}`.

`POST /contacts/{contact_id}/segments/{segment_id}`

Compatibility note: `POST /api/contacts/{id}/segments/{segment_id}` remains available for existing OpenSend integrations; new API clients should prefer the root compatibility path above.

## Authentication

Use an OpenSend API key in the Authorization header. Dashboard session cookies are not API credentials for public API clients.

```http
Authorization: Bearer os_YOUR_API_KEY
```

## When to use it

Use this route to attach one tenant-scoped contact to one tenant-scoped segment after both records already exist. The contact path parameter can be a contact ID or email where the contact route supports that lookup. The segment ID is always supplied in the path.

## Parameters

- `contact_id` — contact ID or email for the authenticated tenant.
- `segment_id` — segment ID for the authenticated tenant.

## Request example

No JSON body is required.

```http
POST /contacts/520784e2-887d-4c25-b53c-4ad46ad38100/segments/78261eea-8f8b-4381-83c6-79fa7120f1cf
Authorization: Bearer os_YOUR_API_KEY
```

## Response

Successful responses confirm the relationship mutation:

```json
{
  "object": "contact_segment",
  "contact_id": "520784e2-887d-4c25-b53c-4ad46ad38100",
  "segment_id": "78261eea-8f8b-4381-83c6-79fa7120f1cf",
  "added": true
}
```

## Errors

OpenSend returns structured errors for missing authentication, validation failures, not-found resources, quota/rate-limit conditions, and unexpected server failures. Treat `404` as either missing or not owned by the caller.

## Self-hosting notes

Self-hosted deployments can use the same path on their own `OPENSEND_BASE_URL`. Run migrations before deploying code that expects new fields, and keep API keys in a secrets manager instead of committing them to source control.
