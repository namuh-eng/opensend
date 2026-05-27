# domain.updated

Domain changed or verification status changed.

## When it is emitted

Domain update, verify, and background verification reconciliation paths can emit `domain.updated`.

## Payload

OpenSend sends this event in the standard webhook envelope:

```json
{
  "id": "whd_delivery-id_1",
  "type": "domain.updated",
  "created_at": "2026-05-10T00:00:00.000Z",
  "data": {}
}
```

Payload includes domain identity fields and may include `previous_status` for verification reconciliation changes.

## Handling guidance

Verify `svix-id`, `svix-timestamp`, and `svix-signature` before processing. Store idempotency by delivery ID or by the domain/email/contact ID in `data` so retries and replays do not duplicate downstream side effects.
