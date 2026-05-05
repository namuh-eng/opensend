---
date: 2026-05-05
issue: "#194"
type: decision
promoted_to: null
---

## Keep /emails POST as a middleware rewrite, not duplicated route logic

**What:** Resend-compatible `POST /emails` is implemented in middleware as a method-specific rewrite to the existing `/api/emails` send handler, while `GET /emails` remains the dashboard page/session flow.

**Why:** The `/emails` URL is already occupied by the dashboard page. A method-specific middleware alias avoids competing App Router page/route files and reuses the existing send handler for payload validation, idempotency, quota, queueing, telemetry, and JSON error envelopes.

**Fix:** When adding root-level API aliases that collide with dashboard pages, keep the alias method-specific in middleware, bypass dashboard session checks only for the API method, and canonicalize rate-limit keys back to the underlying API route when the alias should share a bucket.
