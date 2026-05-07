---
date: 2026-05-07
issue: "#247"
type: decision
promoted_to: null
---

## Centralize API key permission gates at route auth boundaries

Issue #247 adds `src/lib/api-key-permissions.ts` as the narrow permission/domain gate instead of scattering string comparisons. Public non-send API routes should call the full-access helper immediately after API-key/dashboard auth; send routes should call the domain helper after payload validation and before suppression/quota/queue work.

Dashboard-capable routes must use the dashboard-aware helper so session callers continue to work while `sending_access` API-key callers receive the stable 403 error envelope.
