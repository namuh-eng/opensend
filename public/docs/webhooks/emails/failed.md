# email.failed

Provider reject, rendering failure, or retry exhaustion recorded.

## When it is emitted

SES/SNS `Reject` and `RenderingFailure` events normalize to `email.failed`; the queue worker also records failure when provider retries are exhausted.

## Payload

OpenSend sends this event in the standard webhook envelope:

```json
{
  "id": "whd_delivery-id_1",
  "type": "email.failed",
  "created_at": "2026-05-10T00:00:00.000Z",
  "data": {}
}
```

Use this event to alert operators, update support timelines, or dead-letter application workflows.

## Handling guidance

Verify `svix-id`, `svix-timestamp`, and `svix-signature` before processing. Store idempotency by delivery ID or by the domain/email/contact ID in `data` so retries and replays do not duplicate downstream side effects.
