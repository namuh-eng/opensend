# Retrieve Contact Topics

Get topic subscriptions for a contact. This page documents the OpenSend-owned API contract for `GET /contacts/{contact_id}/topics`.

`GET /contacts/{contact_id}/topics`

Compatibility note: `GET /api/contacts/{id}/topics` remains available for existing OpenSend integrations; new API clients should prefer the root compatibility path above.

## Authentication

Use an OpenSend API key in the Authorization header. Dashboard session cookies are not API credentials for public API clients.

```http
Authorization: Bearer os_YOUR_API_KEY
```

## When to use it

Use this route to inspect one contact's topic preference state. It returns topic subscription rows for the target contact and does not modify contact fields.

## Parameters

- `contact_id` — contact ID or email for the authenticated tenant.

## Response

Successful responses return topic preferences for the contact:

```json
{
  "object": "list",
  "data": [
    {
      "id": "7a93a5b0-4f2d-4f8e-8e50-9f043c2fd710",
      "name": "Product Updates",
      "subscription": "opt_in"
    }
  ]
}
```

## Errors

OpenSend returns structured errors for missing authentication, validation failures, not-found resources, quota/rate-limit conditions, and unexpected server failures. Treat `404` as either missing or not owned by the caller.

## Self-hosting notes

Self-hosted deployments can use the same path on their own `OPENSEND_BASE_URL`. Run migrations before deploying code that expects new fields, and keep API keys in a secrets manager instead of committing them to source control.
