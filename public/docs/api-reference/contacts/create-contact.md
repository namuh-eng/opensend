# Create Contact

Create an audience contact. This page documents the OpenSend-owned API contract for `POST /contacts`.

`POST /contacts`

## Authentication

Use an OpenSend API key in the Authorization header. Dashboard session cookies are not API credentials for public API clients.

```http
Authorization: Bearer os_YOUR_API_KEY
```

## When to use it

Contact routes manage audience records for the authenticated tenant. Segment and topic relationship endpoints only affect the target contact and never expose another tenant's audience data. Create a new record using a JSON request body. Send only fields supported by the matching route; validation errors return a structured OpenSend error response.

## Parameters

Path parameters identify the tenant-scoped resource. JSON body fields are validated by the route before any database write.

## Request example

```json
{
  "email": "ada@example.com",
  "firstName": "Ada",
  "lastName": "Lovelace"
}
```

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
