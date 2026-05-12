---
date: 2026-05-12
issue: "#470"
type: decision
promoted_to: null
---

## Tracking subdomain stores the Resend-compatible label, DNS records store the full host

**What:** `tracking_subdomain` is validated and persisted as a single DNS label such as `links`. Domain DNS guidance expands it to `links.<domain>` and emits a pending CNAME whose target is the configured OpenSend tracking host.

**Why:** Resend-compatible create/update payloads use a label, while self-hosters need a copyable full DNS record. Keeping the row value as the label preserves API parity and avoids storing redundant domain names.

**Pattern:** Build the CNAME target from `TRACKING_CNAME_TARGET`, then `TRACKING_BASE_URL`, then app URL env. Preserve full-host reads for historical rows when deriving tracking URLs, but reject dotted values at the validation boundary for new writes.
