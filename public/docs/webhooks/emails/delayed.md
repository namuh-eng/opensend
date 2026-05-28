# email.delayed

Provider retry delay recorded by the queue worker.

## When it is emitted

The queue worker emits `email.delayed` when a provider send attempt fails but provider retry attempts remain. The email is returned to `queued` status and `provider_next_retry_at` is set for the next attempt.

This is separate from `email.delivery_delayed`, which comes from provider lifecycle notifications after provider acceptance.

## Payload

OpenSend sends this event in the standard webhook envelope:

```json
{
  "id": "whd_delivery-id_1",
  "type": "email.delayed",
  "created_at": "2026-05-10T00:00:00.000Z",
  "data": {
    "email_id": "550e8400-e29b-41d4-a716-446655440000",
    "reason": "provider_retry_scheduled",
    "provider": "ses",
    "attempt_count": 2,
    "next_retry_at": "2026-05-10T00:05:00.000Z",
    "last_error": {
      "code": "ThrottlingException",
      "message": "SES is throttling sends"
    }
  }
}
```

Use this event for transient delivery-delay alerts and retry dashboards. Wait for a later sent, delivered, bounced, complained, or failed event before treating the message as terminal.

## Handling guidance

Verify `svix-id`, `svix-timestamp`, and `svix-signature` before processing. Store idempotency by delivery ID or by the domain/email/contact ID in `data` so retries and replays do not duplicate downstream side effects.
