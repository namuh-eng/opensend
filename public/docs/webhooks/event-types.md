# Event Types

OpenSend accepts the following webhook subscription event types.

| Event | Emitted by | Notes |
| --- | --- | --- |
| `email.sent` | SES/SNS send lifecycle ingestion | Provider accepted or sent notification. |
| `email.delivered` | SES/SNS delivery lifecycle ingestion | Final delivery confirmation from the provider. |
| `email.bounced` | SES/SNS bounce lifecycle ingestion | Can also refresh suppressions for bounced recipients. |
| `email.complained` | SES/SNS complaint lifecycle ingestion | Can also refresh suppressions for complained recipients. |
| `email.delivery_delayed` | SES/SNS delivery-delay lifecycle ingestion | Indicates provider-side delay, not final failure. |
| `email.opened` | Open tracking pixel route | Requires tracking token and image load. |
| `email.clicked` | Click tracking redirect route | Requires rewritten tracked links. |
| `email.failed` | SES reject/rendering failure or provider retry exhaustion | Use for operator alerts and support triage. |
| `contact.created` | Contact create API | Emitted after contact persistence succeeds. |
| `contact.updated` | Contact update API | Emitted only when at least one field changes. |
| `contact.deleted` | Contact delete API | Emitted after contact deletion succeeds. |
| `domain.created` | Domain create API | Emitted after domain persistence succeeds. |
| `domain.updated` | Domain update, verify, or reconcile paths | Includes verification-state changes when available. |
| `domain.deleted` | Domain delete API | Emitted after domain deletion succeeds. |

## Reserved but not currently emitted by default

`email.received` is documented as an inbound receiving contract for deployments that add their own MIME ingestion worker. It is not part of the default webhook subscription validation list in this repository today.

## Payload shape

All deliveries use the same outer envelope:

```json
{
  "id": "whd_delivery-id_1",
  "type": "contact.created",
  "created_at": "2026-05-10T00:00:00.000Z",
  "data": {}
}
```

The `data` shape depends on the event source. Email lifecycle events usually carry provider or tracking payloads. Contact and domain events carry OpenSend-owned DTOs described in their event pages.
