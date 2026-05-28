# Receiving Overview

Receiving is the OpenSend area for inbound email rows that your deployment stores for a verified domain.

The current product surface includes a dashboard entry point, received-email read APIs, attachment metadata, and short-lived attachment URLs. The repository does not yet include a complete provider-to-Postgres inbound MIME ingestion worker, so production receiving requires operator setup.

## What is implemented

- Tenant-scoped API reads for `/emails/receiving` and `/emails/receiving/{id}`.
- Attachment listing and presigned attachment URL responses.
- Domain-level receiving controls in the dashboard UI.
- First-class receiving routes for exact addresses, aliases, and catch-all fallback on verified receiving domains.
- A reserved `email.received` event contract for deployments that add inbound ingestion.

## What operators must add

- MX records that route inbound messages to your provider.
- Provider receiving rules, such as SES receipt rules that write raw messages to S3.
- A parser that converts MIME into safe HTML/text, attachment metadata, private object keys, and `received_emails.user_id`.
- Optional webhook or queue emission after storage.

## Recommended setup order

1. Verify the sending domain first so ownership and tenant mapping are clear.
2. Add MX records only after deciding how inbound messages will be stored.
3. Keep raw MIME and attachments in a private bucket.
4. Resolve route decisions with exact-address, alias, catch-all, then unrouteable precedence.
5. Insert parsed rows with the owning OpenSend user ID and `route_decisions` audit metadata.
6. Read messages through the tenant API rather than handing mailbox credentials to apps or agents.
