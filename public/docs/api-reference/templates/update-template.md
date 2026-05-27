# Update Template

Update a template. This page documents the OpenSend-owned API contract for `PATCH /templates/{id}`.

`PATCH /templates/{id}`

## Authentication

Use an OpenSend API key in the Authorization header. Dashboard session cookies are not API credentials for public API clients.

```http
Authorization: Bearer os_YOUR_API_KEY
```

## When to use it

Template routes manage stored email templates. Published templates can be used by sends and broadcasts; draft and preview behavior depends on the renderer metadata stored with the template. Update the mutable fields for the target record. Fields not accepted by the API are ignored or rejected by route validation.

## Parameters

Path parameters identify the tenant-scoped resource. JSON body fields are validated by the route before any database write.

## Request example

```json
{
  "name": "Welcome",
  "subject": "Welcome to OpenSend",
  "html": "<p>Hello {{name}}</p>"
}
```

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
