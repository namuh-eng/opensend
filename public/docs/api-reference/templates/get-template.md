# Get Template

Retrieve a template by id or alias. This page documents the OpenSend-owned API contract for `GET /templates/{id}`.

`GET /templates/{id}`

## Authentication

Use an OpenSend API key in the Authorization header. Dashboard session cookies are not API credentials for public API clients.

```http
Authorization: Bearer os_YOUR_API_KEY
```

## When to use it

Template routes manage stored email templates. Published templates can be used by sends and broadcasts; draft and preview behavior depends on the renderer metadata stored with the template. Retrieve one tenant-scoped record by ID. A missing or cross-tenant ID returns not found instead of leaking ownership details.

## Parameters

Path and query parameters follow the endpoint shape above. IDs are tenant-scoped and should be treated as opaque strings.

## Response

Successful responses return JSON scoped to the authenticated tenant. A representative response shape is:

```json
{
  "id": "template_123",
  "name": "Welcome",
  "status": "draft"
}
```

## Errors

OpenSend returns structured errors for missing authentication, validation failures, not-found resources, quota/rate-limit conditions, and unexpected server failures. Treat `404` as either missing or not owned by the caller.

## Self-hosting notes

Self-hosted deployments can use the same path on their own `OPENSEND_BASE_URL`. Run migrations before deploying code that expects new fields, and keep API keys in a secrets manager instead of committing them to source control.
