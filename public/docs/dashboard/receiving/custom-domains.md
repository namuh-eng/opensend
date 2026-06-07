# Receiving Custom Domains

Use a custom domain or subdomain for inbound addresses that route into OpenSend-backed storage.

## DNS records

Inbound email routing uses MX records. If the same root domain already receives human mailbox traffic elsewhere, use a subdomain such as `inbound.example.com` or `agents.example.com` to avoid disrupting existing mailboxes.

Example operator-owned DNS shape:

| Host | Type | Value |
| --- | --- | --- |
| `inbound.example.com` | MX | Provider receiving endpoint, such as an AWS SES inbound endpoint for your region. |
| `inbound.example.com` | TXT | Optional provider verification record. |

## Tenant mapping

OpenSend received-email rows must include the tenant `user_id`. Your inbound worker should map recipients or domains to the OpenSend user that owns the domain before inserting rows.

## Dashboard status

The dashboard can show receiving-capable domains, but MX validation and provider receipt-rule creation are still operator-owned. For hosted SES receiving, create a receipt rule that stores raw MIME in S3 and publishes SNS notifications to the ingester `/events/inbound/ses-s3` endpoint. Label your internal runbook clearly so users know whether receiving is enabled for a domain or only prepared in DNS.

## Routing rules

After the domain is verified and receiving is enabled, create exact, alias, or catch-all routes from the Receiving page or `/api/receiving/routes`. Routes are tenant-scoped and evaluated in this order: exact address, alias, catch-all, then unrouteable. OpenSend records route decisions on received email rows for later audit and processing.
