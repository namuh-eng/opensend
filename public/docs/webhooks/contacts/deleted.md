# contact.deleted

Contact was deleted.

## When it is emitted

The contact delete API emits `contact.deleted` after deletion succeeds.

## Payload

OpenSend sends this event in the standard webhook envelope:

```json
{
  "id": "whd_delivery-id_1",
  "type": "contact.deleted",
  "created_at": "2026-05-10T00:00:00.000Z",
  "data": {}
}
```

Payload includes the deleted contact `id` and `email`.

## Handling guidance

Verify `svix-id`, `svix-timestamp`, and `svix-signature` before processing. Store idempotency by delivery ID or by the domain/email/contact ID in `data` so retries and replays do not duplicate downstream side effects.
