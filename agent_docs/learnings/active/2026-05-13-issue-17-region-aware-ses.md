---
date: 2026-05-13
issue: 17
type: decision
promoted_to: null
---

# Issue #17: region-aware SES is domain-routed, not transparent failover

OpenSend's Phase 1 multi-region SES behavior should route SES identity and send
operations to the configured domain region (`domains.region`) and fall back to
`us-east-1` only when no sender-domain row can be resolved. Do not implement
transparent same-domain failover or SES Global Endpoints in this slice.

Operational docs need to make the region-scoped SES setup explicit: sandbox /
production access, quotas, domain identity/DKIM, MAIL FROM MX
`feedback-smtp.<region>.amazonses.com`, and SNS feedback topics are all per
sending region.
