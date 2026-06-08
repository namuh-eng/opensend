# Create Contact Property

Create a custom contact property definition for audience management.

`POST /contact-properties`

`POST /api/properties`

## Compatibility behavior

`/contact-properties` is the compatibility alias. In this mode the request body is validated strictly:

- `name` is required and trimmed.
- `key` is required and cannot be omitted.
- `type` is required and must be one of `string`, `number`, `boolean`, or `date`.
- `fallback_value` is optional.

`/api/properties` retains OpenSend extension behavior:

- `key` may be omitted and is derived from `name` when missing.
- `type` defaults to `string` when omitted.
- Existing `/api/properties` integration behavior is preserved.

## Authentication

Use an OpenSend API key in the Authorization header.

```http
Authorization: Bearer os_YOUR_API_KEY
```

Dashboard session cookies are not API credentials.

## Parameters

- `name` (required)
- `key` (optional; required for `/contact-properties`)
- `type` (optional; required for `/contact-properties`)
- `fallback_value` (optional)

## Response

Returns an OpenSend JSON response for the authenticated tenant. Error responses use OpenSend error envelopes and standard HTTP status codes.

## Self-hosting notes

Self-hosted deployments can use the same path on their own `OPENSEND_BASE_URL`. Ensure middleware is enabled so API-like requests are routed to `/api/properties` while dashboard page routes continue to render normally.
