# contact.created

Contact was created.

## When it is emitted

The contact create API emits `contact.created` after persistence succeeds.

## Payload

OpenSend sends this event in the standard webhook envelope:

```json
{
  "id": "whd_delivery-id_1",
  "type": "contact.created",
  "created_at": "2026-05-10T00:00:00.000Z",
  "data": {}
}
```

The payload is the contact webhook DTO from the contact service, including the contact ID, email, profile fields, and preference data available to that service.

## Handling guidance

Verify `svix-id`, `svix-timestamp`, and `svix-signature` before processing. Store idempotency by delivery ID or by the domain/email/contact ID in `data` so retries and replays do not duplicate downstream side effects.
