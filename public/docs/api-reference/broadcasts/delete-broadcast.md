# Delete Broadcast

Delete a broadcast. This page documents the OpenSend-owned API contract for `DELETE /broadcasts/{id}`.

`DELETE /broadcasts/{id}`

## Authentication

Use an OpenSend API key in the Authorization header. Dashboard session cookies are not API credentials for public API clients.

```http
Authorization: Bearer os_YOUR_API_KEY
```

## When to use it

Broadcast routes manage newsletter-style sends for an audience. They operate on the authenticated tenant and use the same contact, segment, topic, and suppression data as the dashboard. Delete or detach the target record for the authenticated tenant. Treat deletes as irreversible unless the resource-specific docs state otherwise.

## Parameters

Path parameters identify the tenant-scoped resource. JSON body fields are validated by the route before any database write.

## Request example

```json
{
  "name": "Product update",
  "subject": "What is new",
  "from": "updates@example.com"
}
```

## Response

Successful responses return JSON scoped to the authenticated tenant. A representative response shape is:

```json
{
  "id": "broadcast_123",
  "name": "Product update",
  "status": "draft"
}
```

## Errors

OpenSend returns structured errors for missing authentication, validation failures, not-found resources, quota/rate-limit conditions, and unexpected server failures. Treat `404` as either missing or not owned by the caller.

## Self-hosting notes

Self-hosted deployments can use the same path on their own `OPENSEND_BASE_URL`. Run migrations before deploying code that expects new fields, and keep API keys in a secrets manager instead of committing them to source control.
