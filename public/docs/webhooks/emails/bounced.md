# email.bounced

Provider bounce notification received.

## When it is emitted

SES/SNS lifecycle ingestion normalizes provider `Bounce` events to `email.bounced`.

## Payload

OpenSend sends this event in the standard webhook envelope:

```json
{
  "id": "whd_delivery-id_1",
  "type": "email.bounced",
  "created_at": "2026-05-10T00:00:00.000Z",
  "data": {}
}
```

Use this event to update support views and suppress bounced recipients. The ingester can refresh suppressions from bounce recipients.

## Handling guidance

Verify `svix-id`, `svix-timestamp`, and `svix-signature` before processing. Store idempotency by delivery ID or by the domain/email/contact ID in `data` so retries and replays do not duplicate downstream side effects.
