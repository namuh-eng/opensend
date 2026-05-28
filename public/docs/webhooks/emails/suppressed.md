# email.suppressed

Send rejected by suppression policy.

## When it is emitted

The send API emits `email.suppressed` when one or more `to` recipients are already suppressed for the caller's tenant. The email is rejected before creating an email row, reserving quota, or queueing delivery.

## Payload

OpenSend sends this event in the standard webhook envelope:

```json
{
  "id": "whd_delivery-id_1",
  "type": "email.suppressed",
  "created_at": "2026-05-10T00:00:00.000Z",
  "data": {
    "reason": "recipient_suppressed",
    "recipients": [
      { "email": "blocked@example.com", "reason": "bounced" }
    ],
    "recipient_count": 1,
    "submitted_at": "2026-05-10T00:00:00.000Z"
  }
}
```

Use this event to update suppression-aware product flows and notify operators that a send request was blocked before provider handoff.

## Handling guidance

Verify `svix-id`, `svix-timestamp`, and `svix-signature` before processing. Store idempotency by delivery ID or by the domain/email/contact ID in `data` so retries and replays do not duplicate downstream side effects.
