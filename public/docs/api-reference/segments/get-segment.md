# Retrieve Segment

Retrieve a segment. This page documents the OpenSend-owned API contract for `GET /segments/{id}`.

`GET /segments/{id}`

## Authentication

Use an OpenSend API key in the Authorization header. Dashboard session cookies are not API credentials for public API clients.

```http
Authorization: Bearer os_YOUR_API_KEY
```

## When to use it

Segment routes manage audience groupings. Segment membership is tenant-scoped and can be used by broadcasts, automations, and dashboard audience filters. Retrieve one tenant-scoped record by ID. A missing or cross-tenant ID returns not found instead of leaking ownership details.

## Parameters

Path and query parameters follow the endpoint shape above. IDs are tenant-scoped and should be treated as opaque strings.

## Response

Successful responses return JSON scoped to the authenticated tenant. A representative response shape is:

```json
{
  "id": "segment_123",
  "name": "Product qualified leads"
}
```

## Errors

OpenSend returns structured errors for missing authentication, validation failures, not-found resources, quota/rate-limit conditions, and unexpected server failures. Treat `404` as either missing or not owned by the caller.

## Self-hosting notes

Self-hosted deployments can use the same path on their own `OPENSEND_BASE_URL`. Run migrations before deploying code that expects new fields, and keep API keys in a secrets manager instead of committing them to source control.
