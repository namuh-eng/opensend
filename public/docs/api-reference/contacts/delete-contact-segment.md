# Delete Contact Segment

Remove an existing contact from an existing segment. This page documents the OpenSend-owned API contract for `DELETE /api/contacts/{id}/segments/{segment_id}`.

`DELETE /api/contacts/{id}/segments/{segment_id}`

## Authentication

Use an OpenSend API key in the Authorization header. Dashboard session cookies are not API credentials for public API clients.

```http
Authorization: Bearer os_YOUR_API_KEY
```

## When to use it

Use this route to detach one tenant-scoped contact from one tenant-scoped segment. It only changes the contact-to-segment relationship; it does not delete the contact or the segment resource.

## Parameters

- `id` — contact ID or email for the authenticated tenant.
- `segment_id` — segment ID for the authenticated tenant.

## Request example

No JSON body is required.

```http
DELETE /api/contacts/520784e2-887d-4c25-b53c-4ad46ad38100/segments/78261eea-8f8b-4381-83c6-79fa7120f1cf
Authorization: Bearer os_YOUR_API_KEY
```

## Response

Successful responses confirm the relationship mutation:

```json
{
  "object": "contact_segment",
  "contact_id": "520784e2-887d-4c25-b53c-4ad46ad38100",
  "segment_id": "78261eea-8f8b-4381-83c6-79fa7120f1cf",
  "deleted": true
}
```

## Errors

OpenSend returns structured errors for missing authentication, validation failures, not-found resources, quota/rate-limit conditions, and unexpected server failures. Treat `404` as either missing or not owned by the caller.

## Self-hosting notes

Self-hosted deployments can use the same path on their own `OPENSEND_BASE_URL`. Run migrations before deploying code that expects new fields, and keep API keys in a secrets manager instead of committing them to source control.
