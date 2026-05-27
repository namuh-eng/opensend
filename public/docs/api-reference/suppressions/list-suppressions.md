# List Suppressions

List suppressed recipients. This page documents the OpenSend-owned API contract for `GET /api/suppressions`.

`GET /api/suppressions`

## Authentication

Use an OpenSend API key in the Authorization header. Dashboard session cookies are not API credentials for public API clients.

```http
Authorization: Bearer os_YOUR_API_KEY
```

## When to use it

Suppressions are an OpenSend extension for managing addresses that should not receive mail. Removing an address permits future sends only if your own consent and compliance rules allow it. Return a tenant-scoped collection. Use pagination parameters when available instead of assuming a fixed result size.

## Parameters

`limit` and `after` may be used on collection routes when the route supports cursor pagination.

## Response

Successful responses return JSON scoped to the authenticated tenant. A representative response shape is:

```json
{
  "data": [
    { "email": "bounced@example.com", "reason": "bounce" }
  ],
  "hasMore": false
}
```

## Errors

OpenSend returns structured errors for missing authentication, validation failures, not-found resources, quota/rate-limit conditions, and unexpected server failures. Treat `404` as either missing or not owned by the caller.

## Self-hosting notes

Self-hosted deployments can use the same path on their own `OPENSEND_BASE_URL`. Run migrations before deploying code that expects new fields, and keep API keys in a secrets manager instead of committing them to source control.
