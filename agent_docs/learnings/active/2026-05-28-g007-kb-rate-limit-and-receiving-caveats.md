---
date: 2026-05-28
issue: g007-deliverability-support-kb
type: decision
promoted_to: null
---

# Support KB should distinguish OpenSend app limits, plan quotas, and provider limits

OpenSend has middleware rate limits from `src/middleware.ts`, hosted plan quotas from the pricing catalog/billing surfaces, and provider-side SES limits for self-hosters. Public support docs should describe them as separate layers so users do not diagnose a 429, a billing quota response, and an SES sandbox/quota rejection as the same failure.

Receiving support docs should keep the G003 caveat: default repo support includes receiving read APIs/storage, but automatic inbound MIME ingestion is operator-owned unless the deployment implements that processor.
