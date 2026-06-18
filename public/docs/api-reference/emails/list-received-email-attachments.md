# List Received Email Attachments

List attachment metadata stored with one received email.

`GET /emails/receiving/{id}/attachments`

Compatibility note: `GET /api/emails/receiving/{id}/attachments` remains available for existing OpenSend integrations; new API clients can use the root compatibility path above.

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
  "object": "list",
  "data": [
    {
      "id": "att_01",
      "filename": "invoice.pdf",
      "content_type": "application/pdf",
      "size": 1234
    }
  ]
}
```

OpenSend stores attachment metadata on the received email row. The binary object is retrieved through the attachment detail endpoint, which returns a short-lived download URL.

## Self-hosting notes

Large inbound attachments should be stored outside Postgres, usually in S3. Store only IDs, filenames, content types, sizes, and private object keys in `received_emails.attachments`.
