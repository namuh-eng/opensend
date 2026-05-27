# domain.deleted

Domain was deleted.

## When it is emitted

The domain delete API emits `domain.deleted` after OpenSend removes the domain row and attempts provider cleanup.

## Payload

OpenSend sends this event in the standard webhook envelope:

```json
{
  "id": "whd_delivery-id_1",
  "type": "domain.deleted",
  "created_at": "2026-05-10T00:00:00.000Z",
  "data": {}
}
```

Payload includes the deleted domain identity and operational metadata returned by the domain detail service.

## Handling guidance

Verify `svix-id`, `svix-timestamp`, and `svix-signature` before processing. Store idempotency by delivery ID or by the domain/email/contact ID in `data` so retries and replays do not duplicate downstream side effects.
