# Receiving Custom Domains

Use a custom domain or subdomain for inbound addresses that route into OpenSend-backed storage.

## DNS records

Inbound email routing uses MX records. If the same root domain already receives human mailbox traffic elsewhere, use a subdomain such as `inbound.example.com` or `agents.example.com` to avoid disrupting existing mailboxes.

Example DNS shape:

| Host | Type | Value |
| --- | --- | --- |
| `inbound.example.com` | MX | `inbound-smtp.<region>.amazonaws.com` for hosted SES receiving. |
| `inbound.example.com` | TXT | Optional provider verification record. |

## Tenant mapping

OpenSend received-email rows must include the tenant `user_id`. Your inbound worker should map recipients or domains to the OpenSend user that owns the domain before inserting rows.

## Dashboard status

When receiving is enabled, hosted OpenSend provisions an SES receipt rule for the domain. The creator still adds the shown MX record so inbound mail reaches SES. Self-hosted operators must configure `SES_INBOUND_SNS_TOPIC_ARN` and `S3_BUCKET_NAME` or `SES_INBOUND_BUCKET_NAME`, subscribe the inbound SNS topic to `/events/inbound/ses-s3`, and grant SES permission to write raw MIME objects to the bucket.

## Routing rules

After the domain is verified and receiving is enabled, create exact, alias, or catch-all routes from the Receiving page or `/api/receiving/routes`. Routes are tenant-scoped and evaluated in this order: exact address, alias, catch-all, then unrouteable. OpenSend records route decisions on received email rows for later audit and processing.
