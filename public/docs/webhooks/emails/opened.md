# email.opened

Open tracking pixel was requested.

## When it is emitted

The tracking pixel route emits `email.opened` after validating an OpenSend tracking token and tenant context.

## Payload

OpenSend sends this event in the standard webhook envelope:

```json
{
  "id": "whd_delivery-id_1",
  "type": "email.opened",
  "created_at": "2026-05-10T00:00:00.000Z",
  "data": {}
}
```

Open tracking depends on image loading and can be blocked or prefetched by clients. Payload fields include `email_id`, `domain_id`, `recipient`, and request metadata.

## Handling guidance

Verify `svix-id`, `svix-timestamp`, and `svix-signature` before processing. Store idempotency by delivery ID or by the domain/email/contact ID in `data` so retries and replays do not duplicate downstream side effects.
