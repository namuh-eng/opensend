# email.complained

Provider complaint notification received.

## When it is emitted

SES/SNS lifecycle ingestion normalizes provider `Complaint` events to `email.complained`.

## Payload

OpenSend sends this event in the standard webhook envelope:

```json
{
  "id": "whd_delivery-id_1",
  "type": "email.complained",
  "created_at": "2026-05-10T00:00:00.000Z",
  "data": {}
}
```

Use this event to stop marketing sends and investigate complaint sources. The ingester can refresh suppressions from complaint recipients.

## Handling guidance

Verify `svix-id`, `svix-timestamp`, and `svix-signature` before processing. Store idempotency by delivery ID or by the domain/email/contact ID in `data` so retries and replays do not duplicate downstream side effects.
