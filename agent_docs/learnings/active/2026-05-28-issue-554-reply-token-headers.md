---
date: 2026-05-28
issue: "#554"
type: decision
promoted_to: null
---

## Reply threading uses address tokens plus custom X header, not generated Message-ID

OpenSend reply threading now signs a stable token from `userId`, outbound `emailId`, and the verified receiving domain, stores it on the outbound row, and embeds it in `reply+<token>@<domain>` plus `X-OpenSend-Reply-Token`.

Do not generate or overwrite `Message-ID` for this feature. SES may reject or override reserved transport headers, and reply matching is already covered by the tenant/domain-scoped recipient token. Inbound parsing can still read tokens from `In-Reply-To` or `References` if a provider preserves a token there, but the send path should avoid adding reserved headers.
