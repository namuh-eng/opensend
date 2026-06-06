---
date: 2026-06-06
issue: "#563"
type: decision
promoted_to: null
---

## Integration webhook credentials stay encrypted and response-redacted

Issue #563's first connector stores the full webhook/Zapier URL and optional
receiver signing secret in `integration_connections.credentials_enc` using
`INTEGRATION_SECRET_ENCRYPTION_KEY` with a `WEBHOOK_SECRET_ENCRYPTION_KEY`
fallback for small self-hosted installs. Public API/dashboard responses expose
only a redacted endpoint preview plus `hasSigningSecret`.

Why: Zapier-style webhook URLs often embed unguessable path tokens, so treating
the URL as connector credential material avoids leaking automation tokens in API
responses, dashboard state, or audit metadata.
