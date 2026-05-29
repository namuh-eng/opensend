# Create Suppression

Create or update one tenant-scoped suppression.

`POST /api/suppressions`

## Authentication

Use a full-access OpenSend API key for public API clients. The dashboard uses the same handler with an authenticated dashboard session.

```http
Authorization: Bearer os_YOUR_API_KEY
Content-Type: application/json
```

## Body

```json
{
  "email": "recipient@example.com",
  "reason": "manual"
}
```

- `email` is required and is normalized to lowercase.
- `reason` is optional and may be `manual`, `bounced`, or `complained`. It defaults to `manual`.

Creating the same email again is idempotent for the tenant: OpenSend updates the existing row and returns the current suppression.

## Response

Successful creates return `201` with the suppression object.
