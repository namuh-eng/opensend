# Retrieve Received Email

Retrieve one stored inbound email for the authenticated tenant.

`GET /emails/receiving/{id}`

Compatibility note: `GET /api/emails/receiving/{id}` remains available for existing OpenSend integrations; new API clients can use the root compatibility path above.

## Authentication

Use an OpenSend API key in the Authorization header. The key owner must match the received email row.

```http
Authorization: Bearer os_YOUR_API_KEY
```

## Path parameters

| Name | Type | Description |
| --- | --- | --- |
| `id` | string | Received email ID. Cross-tenant and missing IDs both return `404`. |

## Response

```json
{
  "object": "received_email",
  "id": "6f6f8b7e-534f-4b62-b0c1-64b79e45f3c2",
  "from": "support@example.com",
  "to": ["agent@inbound.example.com"],
  "subject": "New support request",
  "html": "<p>Hello from a customer.</p>",
  "text": "Hello from a customer.",
  "created_at": "2026-05-10T00:00:00.000Z"
}
```

`html` and `text` can be `null` when your inbound parser did not store that body part. Attachment binaries are not returned from this endpoint; list and retrieve attachment metadata separately.

## Self-hosting notes

The route reads parsed rows from Postgres. If your deployment stores raw MIME in S3, keep that object private and expose only normalized content through your ingestion code or through short-lived attachment URLs.
