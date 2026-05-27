# List Received Emails

List inbound email rows stored for the authenticated OpenSend tenant.

`GET /emails/receiving`

Compatibility note: `GET /api/emails/receiving` remains available for existing OpenSend integrations; new API clients can use the root compatibility path above. Browser dashboard navigation is preserved for page routes that share these names.

## Authentication

Use an OpenSend API key in the Authorization header. The API key must belong to a tenant; dashboard session cookies are not API credentials for public API calls.

```http
Authorization: Bearer os_YOUR_API_KEY
```

## Query parameters

| Name | Type | Description |
| --- | --- | --- |
| `limit` | number | Number of rows to return. Values are clamped from `1` to `100`; default is `20`. |
| `after` | string | Cursor for older rows. OpenSend compares against received-email IDs and returns rows after that cursor in descending order. |
| `to` | string | Optional recipient address filter. OpenSend normalizes whitespace and case before querying the recipient array. |

## Response

```json
{
  "object": "list",
  "data": [
    {
      "id": "6f6f8b7e-534f-4b62-b0c1-64b79e45f3c2",
      "from": "support@example.com",
      "to": ["agent@inbound.example.com"],
      "subject": "New support request",
      "created_at": "2026-05-10T00:00:00.000Z"
    }
  ],
  "has_more": false
}
```

Rows are scoped to the owner of the API key. Empty lists are returned as `200` responses with `data: []`.

## Self-hosting notes

OpenSend currently exposes the read API for inbound rows that your deployment stores in the `received_emails` table. Configure SES receiving, S3 storage, and any parser/ingestion worker in your own deployment before expecting rows to appear. The standalone ingester currently handles SES/SNS sending lifecycle events; full inbound MIME ingestion is an operator integration point, not a hosted promise in this repository.
