---
date: 2026-05-05
issue: "#185"
type: pattern
promoted_to: null
---

## Domain return-path DNS records

**What:** Custom domain create now treats `custom_return_path` as a single DNS label and uses the effective label (`send` by default) for SES MAIL FROM MX/SPF record names.

**Pattern:** Keep DKIM records on the identity domain, but build MX/SPF records as `<effective-return-path>.<domain>` in both persisted records and Cloudflare auto-configure/check paths. API responses should expose both persisted `custom_return_path` and effective `return_path` so clients can show default behavior without rewriting stored rows.
