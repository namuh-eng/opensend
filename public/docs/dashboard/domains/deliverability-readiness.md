# Deliverability readiness

OpenSend tracks readiness/status signals for BIMI, Apple Branded Mail, and dedicated IP lifecycle work. This v1 surface is intentionally status-first: it does not provision BIMI records, submit Apple Branded Mail applications, allocate provider IPs, or run IP warmup automatically.

## BIMI readiness

The domain detail page and API evaluate:

- a BIMI TXT record at `default._bimi.<domain>` (or the configured selector),
- a DMARC TXT record at `_dmarc.<domain>`,
- DMARC enforcement with `p=quarantine` or `p=reject`,
- an HTTPS SVG logo URL from BIMI DNS or stored metadata,
- optional VMC/CMC certificate URL metadata.

OpenSend can report `ready`, `manual_review`, `action_required`, or `not_configured`. Certificate and logo contents are not fetched or validated in v1; operators should verify those assets before announcing provider readiness.

## Apple Branded Mail

Apple Branded Mail is operator-notes only in this slice. Use the status and notes fields to record whether an operator has requested, approved, rejected, or marked the application for manual review outside OpenSend.

## Dedicated IP lifecycle

Dedicated IPs are represented as manual lifecycle records with these statuses: `requested`, `provisioned`, `warming`, `active`, `suspended`, and `retired`.

Creating or updating a dedicated IP record does not call a provider API, allocate an IP, or start warmup. Hosted deployments and self-hosted operators can use the lifecycle record as an audit trail for provider-side work performed manually.
