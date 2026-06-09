---
date: 2026-06-06
issue: 560
type: decision
promoted_to: null
---

## Deliverability readiness v1 is status/manual lifecycle, not provisioning

Issue #560's safe first slice tracks BIMI readiness, Apple Branded Mail operator notes, and dedicated IP lifecycle states without starting provider-side provisioning or warmup. Dedicated IP APIs should create `requested` records and let operators move through `provisioned`, `warming`, `active`, `suspended`, and `retired` manually.

For BIMI checks, prefer already-persisted DNS records when available so dashboard/API tests and recently-created domain records do not block on live DNS. Live DNS lookup remains useful when the stored records do not include the BIMI/DMARC TXT names.

Future provider adapters must be explicit operator/provider actions, not hidden side effects of creating a lifecycle row.
