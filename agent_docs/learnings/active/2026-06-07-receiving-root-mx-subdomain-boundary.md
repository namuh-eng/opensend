---
date: 2026-06-07
issue: receiving-subdomain-boundary
type: decision
promoted_to: null
---

# Receiving setup must not imply root MX is safe to move

Hosted receiving has three separate readiness layers: SES/S3/SNS provider ingress,
customer DNS MX routing, and OpenSend tenant receiving routes. A receipt rule and
confirmed SNS subscription do not make messages visible to a tenant unless the
recipient domain is a verified OpenSend domain with receiving enabled and a
matching receiving route.

Do not auto-publish or recommend replacing root-domain MX when existing mailbox
MX records are present. Prefer a receiving subdomain such as
`inbound.example.com` added as its own OpenSend domain, then publish MX for that
subdomain only.
