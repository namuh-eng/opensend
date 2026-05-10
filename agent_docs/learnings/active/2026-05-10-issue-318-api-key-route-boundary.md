---
date: 2026-05-10
issue: "#318"
type: pattern
promoted_to: null
---

## API-key routes keep auth/quota/cache seams in Next while core owns DTO mapping

**What:** API-key route adapters now share a route-local auth resolver for the
dashboard/API-key split, while `packages/core/src/services/apiKeys.ts` owns the
create-body normalization and public DTO mapping for list/detail/create.

**Why:** The route family needs to stay Next-compatible for dashboard sessions,
quota checks, full-access permission gates, and `invalidateApiKeyAuthCache`
injection, but future adapters should not duplicate token visibility or
snake-case response shaping.

**Pattern:** Keep route code as auth/permission/quota → JSON read → core parser
and service → response mapper. Public token material belongs only to the create
mapper; list/detail mappers must enumerate safe fields so token hashes/previews
cannot leak if repository/service rows grow.
