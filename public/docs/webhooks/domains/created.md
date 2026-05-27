# domain.created

Domain was created.

## When it is emitted

The domain create API emits `domain.created` after persistence succeeds.

## Payload

OpenSend sends this event in the standard webhook envelope:

```json
{
  "id": "whd_delivery-id_1",
  "type": "domain.created",
  "created_at": "2026-05-10T00:00:00.000Z",
  "data": {}
}
```

Payload includes domain identity fields such as `id`, `name`, `status`, `region`, DNS records, capabilities, and creation timestamp when available.

## Handling guidance

Verify `svix-id`, `svix-timestamp`, and `svix-signature` before processing. Store idempotency by delivery ID or by the domain/email/contact ID in `data` so retries and replays do not duplicate downstream side effects.
