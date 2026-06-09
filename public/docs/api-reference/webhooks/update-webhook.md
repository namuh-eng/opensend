# Update Webhook

Update webhook endpoint configuration such as URL, enabled events, or active state.

`PATCH /webhooks/{id}`

Compatibility note: `PATCH /api/webhooks/{id}` remains available for existing OpenSend integrations; new API clients should prefer the root compatibility path above. Browser dashboard navigation is preserved for page routes that share these names.

## Authentication

Use an OpenSend API key in the Authorization header.

```http
Authorization: Bearer os_YOUR_API_KEY
```

Dashboard session cookies are not API credentials.

## Parameters

Delivery signing secrets are not exposed by update responses.

## Response

Returns an OpenSend JSON response for the authenticated tenant. Error responses use OpenSend error envelopes and standard HTTP status codes.

## Self-hosting notes

Self-hosted deployments can use the same path on their own `OPENSEND_BASE_URL`. Ensure middleware is enabled so API-like requests are routed to `/api/webhooks/{id}` while dashboard page requests continue to render normally.
