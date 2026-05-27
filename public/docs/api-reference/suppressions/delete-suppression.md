# Delete Suppression

Remove a recipient from suppressions. This page documents the OpenSend-owned API contract for `DELETE /api/suppressions/{email}`.

`DELETE /api/suppressions/{email}`

## Authentication

Use an OpenSend API key in the Authorization header. Dashboard session cookies are not API credentials for public API clients.

```http
Authorization: Bearer os_YOUR_API_KEY
```

## When to use it

Suppressions are an OpenSend extension for managing addresses that should not receive mail. Removing an address permits future sends only if your own consent and compliance rules allow it. Delete or detach the target record for the authenticated tenant. Treat deletes as irreversible unless the resource-specific docs state otherwise.

## Parameters

Path parameters identify the tenant-scoped resource. JSON body fields are validated by the route before any database write.

## Request example

This operation does not require a large JSON body. Send only the path parameters and any route-supported fields documented by `/openapi.json`.

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
