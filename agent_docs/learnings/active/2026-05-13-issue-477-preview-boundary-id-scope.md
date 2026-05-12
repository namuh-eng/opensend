---
date: 2026-05-13
issue: "#477"
type: decision
promoted_to: null
---

## Template preview service keeps ID-only lookup while sharing renderer semantics

The dashboard preview endpoint is a route for `/api/templates/:id/preview`, so its service boundary should preserve ID-only lookup instead of reusing `findByIdOrAlias`. Reusing the broader public template service lookup would silently add alias support to preview routes and change existing route behavior.

Keep preview orchestration behind a preview-specific service/repository boundary: the route owns only auth, params, HTTP JSON, and error status mapping; the service owns template lookup, `mode: "preview"` variable resolution, registry-controlled React Email rendering, and the existing response DTO shape.
