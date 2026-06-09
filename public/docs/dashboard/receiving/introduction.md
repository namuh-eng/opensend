# Receiving Overview

Receiving is the OpenSend area for inbound email rows that OpenSend stores for a verified domain.

The current product surface includes a dashboard entry point, received-email read APIs, attachment metadata, short-lived attachment URLs, receiving routes, automatic forwarding rules, hosted SES receipt-rule provisioning, and standalone ingester endpoints for provider-to-Postgres MIME ingestion.

## What is implemented

- Tenant-scoped API reads for `/emails/receiving` and `/emails/receiving/{id}`.
- Attachment listing and presigned attachment URL responses.
- Domain-level receiving controls in the dashboard UI.
- First-class receiving routes for exact addresses, aliases, and catch-all fallback on verified receiving domains.
- Automatic forwarding rules with persisted queued, skipped, and failed attempt visibility.
- Hosted SES receipt-rule provisioning when receiving is enabled for a domain.
- Standalone ingester MIME ingestion through `POST /events/inbound`, including route resolution, attachment storage, provider-event idempotency, terminal failure records, and an internal durable `received` event after commit.
- SES receipt-rule ingestion through `POST /events/inbound/ses-s3`, where SNS points OpenSend at a raw MIME object saved by SES in S3.
- Hosted quota accounting and `email.received` webhook delivery rows after inbound commit.

## What must be configured

- MX records that route inbound messages to the SES inbound endpoint shown in the dashboard.
- Hosted deployments must set `SES_INBOUND_SNS_TOPIC_ARN` and `S3_BUCKET_NAME` or `SES_INBOUND_BUCKET_NAME` so OpenSend can create SES receipt rules automatically.
- The inbound SNS topic must subscribe to the ingester `/events/inbound/ses-s3` endpoint, and SES must be allowed to write raw MIME objects to the configured bucket.
- Deployment-specific authentication for provider callbacks. Production ingesters require `INGESTER_INBOUND_TOKEN` on inbound MIME callbacks, and provider-side network controls are still recommended.

## Recommended setup order

1. Verify the sending domain first so ownership and tenant mapping are clear.
2. Enable receiving in the dashboard; hosted OpenSend provisions the SES receipt rule for the domain.
3. Add the shown MX record only after deciding whether the root domain or a dedicated subdomain should receive mail.
4. Keep raw MIME and attachments in a private bucket. For SES, set `SES_INBOUND_BUCKET_NAME` or reuse `S3_BUCKET_NAME` so the ingester only reads expected receipt-rule objects.
5. Resolve route decisions with exact-address, alias, catch-all, then unrouteable precedence.
6. Read messages through the tenant API rather than handing mailbox credentials to apps or agents.
