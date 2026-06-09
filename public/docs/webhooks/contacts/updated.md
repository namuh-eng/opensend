# contact.updated

Contact changed.

## When it is emitted

The contact update API emits `contact.updated` only when one or more fields changed.

## Payload

OpenSend sends this event in the standard webhook envelope:

```json
{
  "id": "whd_delivery-id_1",
  "type": "contact.updated",
  "created_at": "2026-05-10T00:00:00.000Z",
  "data": {}
}
```

Payload includes `id`, `changed_fields`, and a `contact` object with the updated contact webhook DTO.

## Handling guidance

Verify `svix-id`, `svix-timestamp`, and `svix-signature` before processing. Store idempotency by delivery ID or by the domain/email/contact ID in `data` so retries and replays do not duplicate downstream side effects.
