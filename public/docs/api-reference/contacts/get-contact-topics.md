# Retrieve Contact Topics

Get topic subscriptions for a contact. This page documents the OpenSend-owned API contract for `GET /api/contacts/{id}/topics`.

`GET /api/contacts/{id}/topics`

## Authentication

Use an OpenSend API key in the Authorization header. Dashboard session cookies are not API credentials for public API clients.

```http
Authorization: Bearer os_YOUR_API_KEY
```

## When to use it

Contact routes manage audience records for the authenticated tenant. Segment and topic relationship endpoints only affect the target contact and never expose another tenant's audience data. Retrieve one tenant-scoped record by ID. A missing or cross-tenant ID returns not found instead of leaking ownership details.

## Parameters

`limit` and `after` may be used on collection routes when the route supports cursor pagination.

## Response

Successful responses return JSON scoped to the authenticated tenant. A representative response shape is:

```json
{
  "id": "contact_123",
  "email": "ada@example.com",
  "subscribed": true
}
```

## Errors

OpenSend returns structured errors for missing authentication, validation failures, not-found resources, quota/rate-limit conditions, and unexpected server failures. Treat `404` as either missing or not owned by the caller.

## Self-hosting notes

Self-hosted deployments can use the same path on their own `OPENSEND_BASE_URL`. Run migrations before deploying code that expects new fields, and keep API keys in a secrets manager instead of committing them to source control.
