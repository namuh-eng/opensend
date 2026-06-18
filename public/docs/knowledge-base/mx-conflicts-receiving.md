# MX conflicts and receiving domains

MX records decide where inbound mail for a domain is delivered. Changing MX records can interrupt existing mailbox providers, help desks, or routing rules, so plan receiving setup carefully.

## Before changing MX

- Identify where mail currently lands: Google Workspace, Microsoft 365, a help desk, or another provider.
- Decide whether OpenSend should receive the whole domain or only a subdomain such as `inbound.example.com`.
- Confirm your OpenSend deployment has an inbound ingestion path. Hosted OpenSend provisions SES receipt rules when receiving is enabled; self-hosted deployments must configure the inbound SNS topic, raw MIME bucket, and ingester endpoint first.

## Safe patterns

Use a dedicated subdomain for application inbound workflows. Keep human mailboxes on the existing provider unless you are intentionally migrating all mail.

## Troubleshooting

If inbound messages disappear after MX changes, check authoritative DNS, MX priority, provider logs, and whether the receiving processor is actually writing `received_emails` rows.
