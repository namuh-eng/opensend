# Receiving Overview

Receiving is the OpenSend area for inbound email rows that your deployment stores for a verified domain.

The current product surface includes a dashboard entry point, received-email read APIs, attachment metadata, short-lived attachment URLs, receiving routes, automatic forwarding rules, and a standalone ingester endpoint for provider-to-Postgres MIME ingestion. Operators still own MX records and provider receipt-rule wiring for their deployment.

## What is implemented

- Tenant-scoped API reads for `/emails/receiving` and `/emails/receiving/{id}`.
- Attachment listing and presigned attachment URL responses.
- Domain-level receiving controls in the dashboard UI.
- First-class receiving routes for exact addresses, aliases, and catch-all fallback on verified receiving domains.
- Automatic forwarding rules with persisted queued, skipped, and failed attempt visibility.
- Standalone ingester MIME ingestion through `POST /events/inbound`, including route resolution, attachment storage, provider-event idempotency, terminal failure records, and an internal durable `received` event after commit.

## What operators must add

- MX records that route inbound messages to your provider.
- Provider receiving rules, such as SES receipt rules that deliver raw messages or S3 object notifications to the ingester boundary.
- Deployment-specific authentication for provider callbacks. Production ingesters require `INGESTER_INBOUND_TOKEN` on inbound MIME callbacks, and provider-side network controls are still recommended.
- Optional forwarding, reply workflows, or public webhook emission after storage; those are not part of the ingestion foundation.

## Recommended setup order

1. Verify the sending domain first so ownership and tenant mapping are clear.
2. Add MX records only after deciding how inbound messages will be stored.
3. Keep raw MIME and attachments in a private bucket.
4. Resolve route decisions with exact-address, alias, catch-all, then unrouteable precedence.
5. Point provider notifications at the standalone ingester `/events/inbound` endpoint.
6. Read messages through the tenant API rather than handing mailbox credentials to apps or agents.
