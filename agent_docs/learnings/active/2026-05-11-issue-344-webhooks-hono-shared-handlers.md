---
date: 2026-05-11
issue: "#344"
type: pattern
promoted_to: null
---

## Webhook Hono parity should share request handlers, not Next route modules

For control-plane webhook parity, keep the Next App Router files as thin adapters over shared `Request -> Response` handlers under `src/lib/api/webhooks/`. The Hono service can mount those same handlers from `services/api/src/routes/webhooks.ts` without importing `src/app/api/...` route modules or manufacturing Next `params` objects.

This preserves the existing public response mapping and validation behavior while keeping the control-plane service out of Next route internals. Future public API route-family parity slices should prefer this shape when the existing logic still depends on app-level auth/validation helpers and is not ready for a deeper `packages/core` extraction.
