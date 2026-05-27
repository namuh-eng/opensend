# email.received

`email.received` is the event name OpenSend reserves for inbound email notifications.

Inbound receiving is currently a deployment integration point: the repository includes read APIs and storage schema for received email rows, but it does not include a complete SES inbound MIME parser that emits this event automatically. If you build that parser for your self-hosted deployment, use the payload shape below so downstream agents and webhook consumers can rely on a stable contract.

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

OpenSend webhook deliveries use the same signing and retry guidance as other events. Verify the `webhook-id`, `webhook-timestamp`, and `webhook-signature` headers before acting on the inbound email. See [Verify webhook requests](../verify-webhooks-requests.md) and [Retries and replays](../retries-and-replays.md).

## Operator status

This page documents the first-party contract to use when inbound ingestion is enabled in your deployment. Hosted or self-hosted installs that only run the default SES/SNS lifecycle ingester should not expect `email.received` events until an inbound receiving worker is added.
