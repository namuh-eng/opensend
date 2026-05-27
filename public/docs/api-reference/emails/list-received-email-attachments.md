# List Received Email Attachments

List attachments parsed from one inbound email.

`GET /emails/receiving/{id}/attachments`

Compatibility note: `GET /api/emails/receiving/{id}/attachments` remains available for existing OpenSend integrations; new API clients should prefer the root compatibility path above. Browser dashboard navigation is preserved for page routes that share these names.

## Authentication

Use an OpenSend API key in the Authorization header.

```http
Authorization: Bearer os_YOUR_API_KEY
```

Dashboard session cookies are not API credentials.

## Parameters

Large attachments may be stored outside Postgres.

## Response

Returns an OpenSend JSON response for the authenticated tenant. Error responses use OpenSend error envelopes and standard HTTP status codes.

## Self-hosting notes

Self-hosted deployments can use the same path on their own `OPENSEND_BASE_URL`. Ensure middleware is enabled so API-like requests are routed to `/api/emails/receiving/{id}/attachments` while dashboard page requests continue to render normally.
