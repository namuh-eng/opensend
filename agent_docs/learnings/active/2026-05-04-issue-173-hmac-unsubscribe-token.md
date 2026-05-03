---
date: 2026-05-04
issue: "#173"
type: decision
promoted_to: null
---

## Use stateless HMAC unsubscribe tokens for the parity slice

**What:** Public unsubscribe URLs use the contact id plus a stable HMAC token (`UNSUBSCRIBE_SECRET`, then auth/dashboard secret fallbacks) instead of a new token table or raw contact id authorization.
**Why:** The issue needs durable sent links and a public one-click route without weakening `/api/contacts/:id` API-key auth. A stateless signature keeps the slice small and avoids migration/schema churn while preventing raw ids from being the only boundary.
**Fix:** Future preference-center or suppression-list work can add persisted token/revocation state, but should preserve existing HMAC links or provide a migration/compatibility path for emails already sent.
