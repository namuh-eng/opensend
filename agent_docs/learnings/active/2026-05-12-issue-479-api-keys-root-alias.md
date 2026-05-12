---
date: 2026-05-12
issue: "#479"
type: pattern
promoted_to: null
---

## API key root aliases must stay in middleware because dashboard pages own the path

**What:** `/api-keys` and `/api-keys/:id` are dashboard page routes, so the Resend-compatible create/list/delete aliases should be middleware rewrites to `/api/api-keys` rather than new App Router route files.

**Why:** Adding route files at the same public paths would collide with the signed-in dashboard pages. For collection `GET`, only explicit API signals (`Authorization`, `Accept: application/json`, or JSON content type) should trigger the rewrite; browser and RSC requests must keep the dashboard session flow.

**Fix:** Use middleware alias detection for `GET/POST /api-keys` and `DELETE /api-keys/:id`, preserve the existing API-key route auth/tenant/quota/audit/cache behavior by rewriting to `/api/api-keys`, and keep SDK calls on the root Resend-compatible paths.
