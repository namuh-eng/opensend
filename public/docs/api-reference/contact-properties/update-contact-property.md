# Update Contact Property

Update display metadata for a custom contact property.

`PATCH /contact-properties/{id}`

Compatibility behavior:

- `/contact-properties/{id}` is the compatibility alias handled by middleware rewrite to `/api/properties/{id}`.
- In compatibility mode, if `type` is provided it must be one of: `string` | `number` | `boolean` | `date`.
- `name` and `fallback_value` remain editable for legacy-compatible updates.
- `key` is create-only/stable and is not patch-updated by this route.
- `PATCH /api/properties/{id}` remains legacy compatible for existing OpenSend integrations.


## Authentication

Use an OpenSend API key in the Authorization header.

```http
Authorization: Bearer os_YOUR_API_KEY
```

Dashboard session cookies are not API credentials.

## Parameters

Changing property semantics after use can affect segmentation.

## Response

Returns an OpenSend JSON response for the authenticated tenant. Error responses use OpenSend error envelopes and standard HTTP status codes.

## Self-hosting notes

Self-hosted deployments can use the same path on their own `OPENSEND_BASE_URL`. Ensure middleware is enabled so API-like requests are routed to `/api/properties/{id}` while dashboard page requests continue to render normally.
