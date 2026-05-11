---
date: 2026-05-11
issue: "#363"
type: pattern
promoted_to: null
---

## Automations dashboard routes accept session auth, public callers still need full-access API keys

Dashboard automations UI should call same-origin `/api/automations/**` endpoints without reading or sending a stored client API key. The route adapter resolves either a signed-in Better Auth dashboard session or a bearer API key, then preserves the existing full-access permission gate only for API-key callers.

Keep public SDK/API behavior covered with bearer-key tests, but add dashboard-session tests for list/detail/create/update/delete/run flows so dashboard regressions do not reintroduce `localStorage.api_key` requirements.
