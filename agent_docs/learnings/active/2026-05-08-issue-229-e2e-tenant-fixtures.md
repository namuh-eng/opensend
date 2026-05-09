---
date: 2026-05-08
issue: "#229"
type: pattern
promoted_to: null
---

## Tenant-isolation E2E specs should create real users plus API keys

**What:** Issue #229 adds shared Playwright helpers that create deterministic Better Auth users/sessions, full-access API keys, and cleanup by `E2E_RUN_ID`/test title. The canonical tenant-isolation proof uses real app routes and Postgres rows instead of route mocks.
**Why:** API-key tenant ownership depends on the `api_keys.user_id` resolved by `validateApiKey`; a signed dashboard cookie alone does not prove public API isolation.
**Fix:** For future cross-tenant API regressions, create two tenants with `createE2ETenant`, call app routes via `APIRequestContext`, assert list exclusion plus 404/deny on detail and mutation, then call `cleanupE2ERun` in `finally`.
