# Update Contact Topics

Update topic subscriptions for a contact. This page documents the OpenSend-owned API contract for `PATCH /contacts/{contact_id}/topics`.

`PATCH /contacts/{contact_id}/topics`

Compatibility note: `PATCH /api/contacts/{id}/topics` remains available for existing OpenSend integrations; new API clients should prefer the root compatibility path above.

## Authentication

Use an OpenSend API key in the Authorization header. Dashboard session cookies are not API credentials for public API clients.

```http
Authorization: Bearer os_YOUR_API_KEY
```

## When to use it

Use this route to replace one contact's topic subscription preferences. It only updates topic relationship state; it does not update the contact's name, email, custom properties, or segment memberships.

## Parameters

- `contact_id` — contact ID or email for the authenticated tenant.

## Request example

```json
{
  "topics": [
    { "id": "7a93a5b0-4f2d-4f8e-8e50-9f043c2fd710", "subscription": "opt_in" },
    { "id": "ab9b8b4e-b36d-44a1-8ff0-9971bb9aee4c", "subscription": "opt_out" }
  ]
}
```

## Response

Successful responses confirm the topic relationship update:

```json
{
  "object": "contact_topics",
  "contact_id": "520784e2-887d-4c25-b53c-4ad46ad38100",
  "updated": true
}
```

## Errors

OpenSend returns structured errors for missing authentication, validation failures, not-found resources, quota/rate-limit conditions, and unexpected server failures. Treat `404` as either missing or not owned by the caller.

## Self-hosting notes

Self-hosted deployments can use the same path on their own `OPENSEND_BASE_URL`. Run migrations before deploying code that expects new fields, and keep API keys in a secrets manager instead of committing them to source control.
