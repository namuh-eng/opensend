---
date: 2026-06-08
issue: "#611"
type: pattern
promoted_to: null
---

## Root OpenAPI aliases need an explicit runtime-backed allowlist

Root-compatible OpenAPI paths should be documented only when runtime evidence exists in either `src/middleware.ts` rewrites or root App Router `route.ts` files. For collision paths like `/api-keys` and `/broadcasts`, collection aliases are middleware-gated so dashboard page GETs keep working; detail aliases can come from root route files where they exist.

Keep pending roots such as automations, events, broadcast metrics, and contact relationship roots out of OpenAPI until a runtime route exists. A focused contract test should compare root operations against an explicit allowlist so implemented aliases cannot disappear and unsupported aliases cannot be advertised silently.
