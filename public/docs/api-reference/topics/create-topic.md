# Create Topic

Create a subscription topic for audience preference management.

`POST /topics`

`POST /api/topics`

## Compatibility behavior

`/topics` is the compatibility alias. In this mode the request body is validated strictly:

- `name` is required and trimmed.
- `default_subscription` is required and must be either `opt_in` or `opt_out`.
- `visibility` is required and must be either `public` or `private`.
- `description` is optional and still capped at 200 characters.
- `default_subscription` is creation-time behavior for the Resend-compatible API and cannot be changed later through `/topics/{id}`.

`/api/topics` retains OpenSend extension behavior:

- Missing `default_subscription` defaults to `opt_out`.
- Missing `visibility` defaults to `public`.
- Invalid values for those fields are still normalized to legacy defaults.

## Authentication

Use an OpenSend API key in the Authorization header.

```http
Authorization: Bearer os_YOUR_API_KEY
```

Dashboard session cookies are not API credentials.

## Parameters

Body includes topic display fields accepted by this API.

- `name` (required)
- `description` (optional)
- `default_subscription` (optional; strict root mode requires it)
- `visibility` (optional; strict root mode requires it)

## Response

Returns an OpenSend JSON response for the authenticated tenant. Error responses use OpenSend error envelopes and standard HTTP status codes.

## Self-hosting notes

Self-hosted deployments can use the same path on their own `OPENSEND_BASE_URL`. Ensure middleware is enabled so API-like requests are routed to `/api/topics` while dashboard page requests continue to render normally.
