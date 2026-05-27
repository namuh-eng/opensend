# email.delivery_delayed

Provider delivery delay notification received.

## When it is emitted

SES/SNS lifecycle ingestion normalizes provider `DeliveryDelay` events to `email.delivery_delayed`.

## Payload

OpenSend sends this event in the standard webhook envelope:

```json
{
  "id": "whd_delivery-id_1",
  "type": "email.delivery_delayed",
  "created_at": "2026-05-10T00:00:00.000Z",
  "data": {}
}
```

Use this event for delayed-delivery visibility. It is not a final failure; wait for delivered, bounced, complained, or failed follow-up events.

## Handling guidance

Verify `svix-id`, `svix-timestamp`, and `svix-signature` before processing. Store idempotency by delivery ID or by the domain/email/contact ID in `data` so retries and replays do not duplicate downstream side effects.
