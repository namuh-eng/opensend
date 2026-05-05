---
date: 2026-05-05
issue: "#188"
type: pattern
promoted_to: null
---

## DMARC DNS guidance parity

**What:** Domain record generation now emits a starter `_dmarc.<domain>` TXT record with `v=DMARC1; p=none;` alongside DKIM and return-path SPF/MX. Cloudflare auto-configure creates that record only when missing and warns instead of overwriting an existing DMARC policy.

**Pattern:** Treat DMARC as identity-domain guidance, not return-path DNS. Preserve existing domain records during auto-configure and only replace records Cloudflare actually created or updated so skipped customer-owned DMARC policies do not disappear from the dashboard guidance payload.
