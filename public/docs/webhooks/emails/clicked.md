# email.clicked

Tracked link redirect was requested.

## When it is emitted

The click tracking route emits `email.clicked` after validating an OpenSend tracking token and target URL.

## Payload

OpenSend sends this event in the standard webhook envelope:

```json
{
  "id": "whd_delivery-id_1",
  "type": "email.clicked",
  "created_at": "2026-05-10T00:00:00.000Z",
  "data": {}
}
```

Click tracking depends on rewritten links. Payload fields include `email_id`, `domain_id`, `recipient`, `url`, and request metadata.

## Handling guidance

Verify `svix-id`, `svix-timestamp`, and `svix-signature` before processing. Store idempotency by delivery ID or by the domain/email/contact ID in `data` so retries and replays do not duplicate downstream side effects.
