# Ingester Deployment

Deploy the standalone ingester and queue worker. Provider callbacks should target the ingester service, not the Next.js app URL.

## Endpoints

- `POST /events/ses` — SES/SNS sending lifecycle notifications for delivered, bounced, complained, opened, and clicked events.
- `POST /events/inbound` — inbound MIME provider notifications. The payload must include `event_id` and either `raw_mime`, `raw_mime_base64`, or `raw_mime_url`.
- `POST /jobs/poll`, `/jobs/scheduled-emails`, `/jobs/webhooks`, `/jobs/domain-verify` — internal job endpoints, optionally protected by `INGESTER_JOB_TOKEN`.

Set `INGESTER_INBOUND_TOKEN` to require `Authorization: Bearer <token>` on inbound MIME notifications.

## Inbound payload

```json
{
  "provider": "ses-receiving",
  "event_id": "provider-event-id",
  "message_id": "provider-message-id",
  "recipients": ["support@inbound.example.com"],
  "raw_mime_base64": "...",
  "metadata": { "receipt_rule": "opensend-inbound" }
}
```

The ingester stores sanitized provider metadata in `inbound_provider_events`, parses MIME headers/body/attachments, resolves the recipient domain/route to one tenant, validates OpenSend reply tokens for conversation threading, uploads attachment bodies through OpenSend storage, inserts `received_emails`, writes an internal durable `email_events` row of type `received`, and then evaluates matching forwarding rules without deleting or hiding the stored message.

Terminal outcomes are recorded for malformed MIME, missing or ambiguous receiving domain, oversized messages, attachment storage failure, and duplicate provider events. Raw MIME bodies and secrets are not written to logs or provider metadata.


## Reply-domain setup

For threaded replies, run the app and ingester with the same `OPENSEND_REPLY_TOKEN_SECRET`, enable receiving on the sending domain, and point that domain's inbound provider notifications at `POST /events/inbound`. Outbound sends from receiving-enabled domains get generated reply addresses and headers; inbound messages with invalid or cross-tenant tokens stay unmatched for the resolved recipient-domain tenant instead of being attached to another tenant's thread.
