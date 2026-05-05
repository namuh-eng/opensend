---
date: 2026-04-30
issue: "#140"
type: decision
promoted_to: null
---

## Sidebar logout needs same-origin auth client and Edge-safe page middleware

The dashboard logout control should use Better Auth through the current app origin unless `NEXT_PUBLIC_APP_URL` is explicitly set. Keeping a hardcoded localhost fallback can send sign-out traffic to the wrong port during Playwright/dev runs.

Dashboard page E2E also depends on middleware staying Edge-safe before API rate-limit code runs. Keep Node Redis imports out of the page-route middleware path; only load Redis rate-limit code after an `/api/*` request has opted into the Redis backend.
