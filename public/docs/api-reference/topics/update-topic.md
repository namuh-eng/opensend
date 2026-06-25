# Update Topic

Update mutable subscription topic fields.

`PATCH /topics/{id}`

Compatibility behavior:

- `/topics/{id}` is the compatibility alias handled by middleware rewrite to `/api/topics/{id}`.
- In compatibility mode, `visibility` is validated strictly when provided: `public` | `private`.
- `default_subscription` and `defaultSubscription` cannot be changed after topic creation through the Resend-compatible alias.
- `name` and `description` remain optional for partial updates.
- `PATCH /api/topics/{id}` remains legacy compatible for existing OpenSend integrations and may still normalize `default_subscription` updates as an OpenSend-specific extension.

Note: compatibility updates are partial. Create a new topic when the default subscription policy needs to change for Resend-compatible clients.

## Authentication

Use an OpenSend API key in the Authorization header.

```http
Authorization: Bearer os_YOUR_API_KEY
```

Dashboard session cookies are not API credentials.

## Parameters

Existing contact preferences remain attached to the topic.

## Response

Returns an OpenSend JSON response for the authenticated tenant. Error responses use OpenSend error envelopes and standard HTTP status codes.

## Self-hosting notes

Self-hosted deployments can use the same path on their own `OPENSEND_BASE_URL`. Ensure middleware is enabled so API-like requests are routed to `/api/topics/{id}` while dashboard page requests continue to render normally.
