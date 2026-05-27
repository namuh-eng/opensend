# Create API Key

Create a new API key. This page documents the OpenSend-owned API contract for `POST /api-keys`.

`POST /api-keys`

## Authentication

Use an OpenSend API key in the Authorization header. Dashboard session cookies are not API credentials for public API clients.

```http
Authorization: Bearer os_YOUR_API_KEY
```

## When to use it

API key routes are account-management endpoints. Newly created tokens are only shown once, so store the `os_...` value in your secrets manager and rotate by creating a replacement key before deleting the old one. Create a new record using a JSON request body. Send only fields supported by the matching route; validation errors return a structured OpenSend error response.

## Parameters

Path parameters identify the tenant-scoped resource. JSON body fields are validated by the route before any database write.

## Request example

```json
{
  "name": "Production worker"
}
```

## Response

Successful responses return JSON scoped to the authenticated tenant. A representative response shape is:

```json
{
  "id": "api_key_123",
  "name": "Production worker",
  "token": "os_...",
  "createdAt": "2026-05-28T00:00:00.000Z"
}
```

## Errors

OpenSend returns structured errors for missing authentication, validation failures, not-found resources, quota/rate-limit conditions, and unexpected server failures. Treat `404` as either missing or not owned by the caller.

## Self-hosting notes

Self-hosted deployments can use the same path on their own `OPENSEND_BASE_URL`. Run migrations before deploying code that expects new fields, and keep API keys in a secrets manager instead of committing them to source control.
