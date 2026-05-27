# email.delivered

Provider delivery notification received.

## When it is emitted

SES/SNS lifecycle ingestion normalizes provider `Delivery` events to `email.delivered`.

## Payload

OpenSend sends this event in the standard webhook envelope:

```json
{
  "id": "whd_delivery-id_1",
  "type": "email.delivered",
  "created_at": "2026-05-10T00:00:00.000Z",
  "data": {}
}
```

Use this event to move downstream workflows from sent to delivered. The payload is the provider delivery payload.

## Handling guidance

Verify `svix-id`, `svix-timestamp`, and `svix-signature` before processing. Store idempotency by delivery ID or by the domain/email/contact ID in `data` so retries and replays do not duplicate downstream side effects.
