# email.received

OpenSend emits `email.received` after committing an inbound email row for a receiving-enabled domain.

## When it is emitted

OpenSend emits this event after the standalone ingester accepts an inbound provider notification, parses the raw MIME message, resolves the recipient to one tenant, stores the received email row, and commits attachment metadata. The event is not emitted for malformed messages, duplicate provider events, unrouteable messages, oversized messages, storage failures, or messages blocked by hosted quota.

## Recommended payload

```json
{
  "type": "email.received",
  "created_at": "2026-05-10T00:00:00.000Z",
  "data": {
    "id": "6f6f8b7e-534f-4b62-b0c1-64b79e45f3c2",
    "from": "support@example.com",
    "to": ["agent@inbound.example.com"],
    "subject": "New support request",
    "created_at": "2026-05-10T00:00:00.000Z",
    "attachments": [
      {
        "id": "att_01",
        "filename": "invoice.pdf",
        "content_type": "application/pdf",
        "size": 1234
      }
    ]
  }
}
```

Keep the webhook payload metadata-only. Retrieve bodies with `GET /emails/receiving/{id}` and attachments with `GET /emails/receiving/{id}/attachments/{attachmentId}` after verifying the webhook signature.

## Delivery and verification

OpenSend webhook deliveries use the same signing and retry guidance as other events. Verify the `svix-id`, `svix-timestamp`, and `svix-signature` headers before acting on the inbound email. See [Verify webhook requests](../verify-webhooks-requests.md) and [Retries and replays](../retries-and-replays.md).
