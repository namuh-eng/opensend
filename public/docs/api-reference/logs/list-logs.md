# List Logs

List API request logs for debugging delivery, auth, and integration behavior.

`GET /logs`

Compatibility note: `GET /api/logs` remains available for existing OpenSend integrations; new API clients should prefer the root compatibility path above. Browser dashboard navigation is preserved for page routes that share these names.

## Authentication

Use an OpenSend API key in the Authorization header.

```http
Authorization: Bearer os_YOUR_API_KEY
```

Dashboard session cookies are not API credentials.

## Parameters

Supports filters such as status, method, API key, date range, text search, and email tag filters.

Tag filters use the same validation semantics as send-time tags:

- `tag_name` / `tagName`: ASCII letters, numbers, underscores, or dashes; 1-256 characters.
- `tag_value` / `tagValue`: optional; ASCII letters, numbers, underscores, or dashes; up to 256 characters; may be empty.

`tag_value` requires `tag_name`. Tag-filtered logs only match request logs linked to tenant-owned emails through sanitized log metadata (`emailId` or `emailIds`).

## Response

Returns an OpenSend JSON response for the authenticated tenant. Error responses use OpenSend error envelopes and standard HTTP status codes.

## Self-hosting notes

Self-hosted deployments can use the same path on their own `OPENSEND_BASE_URL`. Ensure middleware is enabled so API-like requests are routed to `/api/logs` while dashboard page requests continue to render normally.
