# Event Types

OpenSend accepts the following webhook subscription event types.

| Event | Emitted by | Notes |
| --- | --- | --- |
| `email.sent` | SES/SNS send lifecycle ingestion | Provider accepted or sent notification. |
| `email.delivered` | SES/SNS delivery lifecycle ingestion | Final delivery confirmation from the provider. |
| `email.bounced` | SES/SNS bounce lifecycle ingestion | Can also refresh suppressions for bounced recipients. |
| `email.complained` | SES/SNS complaint lifecycle ingestion | Can also refresh suppressions for complained recipients. |
| `email.delivery_delayed` | SES/SNS delivery-delay lifecycle ingestion | Indicates provider-side delay after provider acceptance, not final failure. |
| `email.scheduled` | Send API scheduled delivery acceptance | Emitted after a future `scheduled_at` send is persisted. |
| `email.delayed` | Queue worker provider retry state | Emitted when provider handoff failed but retry attempts remain. |
| `email.suppressed` | Send API suppression policy check | Emitted when suppressed recipients block a send before email-row creation. |
| `email.opened` | Open tracking pixel route | Requires tracking token and image load. |
| `email.clicked` | Click tracking redirect route | Requires rewritten tracked links. |
| `email.failed` | SES reject/rendering failure or provider retry exhaustion | Use for operator alerts and support triage. |
| `contact.created` | Contact create API | Emitted after contact persistence succeeds. |
| `contact.updated` | Contact update API | Emitted only when at least one field changes. |
| `contact.deleted` | Contact delete API | Emitted after contact deletion succeeds. |
| `domain.created` | Domain create API | Emitted after domain persistence succeeds. |
| `domain.updated` | Domain update, verify, or reconcile paths | Includes verification-state changes when available. |
| `domain.deleted` | Domain delete API | Emitted after domain deletion succeeds. |

## Inbound receiving

`email.received` is emitted after the OpenSend ingester commits an inbound email row for a receiving-enabled domain. Its webhook payload is metadata-only; retrieve content and attachments through the received-email APIs.

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
