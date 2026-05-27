# Retrieve Received Email Attachment

Retrieve one attachment record for a received email and get a short-lived private download URL.

`GET /emails/receiving/{id}/attachments/{attachmentId}`

Compatibility note: `GET /api/emails/receiving/{id}/attachments/{attachmentId}` remains available for existing OpenSend integrations; new API clients can use the root compatibility path above.

## Authentication

Use an OpenSend API key in the Authorization header. The key owner must match the received email row.

```http
Authorization: Bearer os_YOUR_API_KEY
```

## Path parameters

| Name | Type | Description |
| --- | --- | --- |
| `id` | string | Received email ID. |
| `attachmentId` | string | Attachment ID from the attachment list response. |

## Response

```json
{
  "object": "received_email_attachment",
  "id": "att_01",
  "filename": "invoice.pdf",
  "content_type": "application/pdf",
  "size": 1234,
  "download_url": "https://storage.example.com/private-object?...",
  "expires_at": "2026-05-10T13:00:00.000Z"
}
```

`download_url` is generated from the private object key saved by your receiving pipeline. OpenSend sets the response expiration one hour after the request time.

## Self-hosting notes

Keep the backing bucket private. Do not persist presigned URLs; request a fresh attachment detail response when an agent, workflow, or support tool needs the file.
