# email.scheduled

Future delivery accepted and stored.

## When it is emitted

The send API emits `email.scheduled` after a future `scheduled_at` value is accepted, the email row is persisted with `scheduled` status, and no immediate send job is queued.

## Payload

OpenSend sends this event in the standard webhook envelope:

```json
{
  "id": "whd_delivery-id_1",
  "type": "email.scheduled",
  "created_at": "2026-05-10T00:00:00.000Z",
  "data": {
    "email_id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "scheduled",
    "scheduled_at": "2026-05-10T12:00:00.000Z",
    "accepted_at": "2026-05-10T00:00:00.000Z",
    "recipient_count": 1
  }
}
```

Use this event to show queued future delivery, build customer reminders, or reconcile scheduled-send workflows before provider handoff.

## Handling guidance

Verify `svix-id`, `svix-timestamp`, and `svix-signature` before processing. Store idempotency by delivery ID or by the domain/email/contact ID in `data` so retries and replays do not duplicate downstream side effects.
