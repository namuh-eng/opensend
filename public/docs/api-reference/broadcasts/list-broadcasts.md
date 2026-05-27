# List Broadcasts

List broadcasts. This page documents the OpenSend-owned API contract for `GET /broadcasts`.

`GET /broadcasts`

## Authentication

Use an OpenSend API key in the Authorization header. Dashboard session cookies are not API credentials for public API clients.

```http
Authorization: Bearer os_YOUR_API_KEY
```

## When to use it

Broadcast routes manage newsletter-style sends for an audience. They operate on the authenticated tenant and use the same contact, segment, topic, and suppression data as the dashboard. Return a tenant-scoped collection. Use pagination parameters when available instead of assuming a fixed result size.

## Parameters

`limit` and `after` may be used on collection routes when the route supports cursor pagination.

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
