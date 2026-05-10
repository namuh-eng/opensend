---
date: 2026-05-10
issue: "#316"
type: pattern
promoted_to: null
---

## Audience metadata service boundaries must preserve the split auth contract

**What:** Standalone segments/topics/properties collection routes accept either full-access API keys or dashboard sessions, but their `[id]` detail routes are API-key-only. The dashboard auth helper returns `{ dashboard: true }` without a user id, so thin adapters must resolve the Better Auth session user before calling tenant-scoped core services.

**Why:** Moving DB logic into `packages/core` makes tenant scoping explicit (`userId` is required for list/detail/mutation). Silently treating dashboard auth as userless would turn valid dashboard collection calls into 401s; silently widening detail routes to dashboard sessions would change the public auth contract.

**Fix:** Keep route adapters responsible for auth-mode resolution: collection routes call `authorizeDashboardOrApiKey` then resolve dashboard `user.id`; detail routes keep `validateApiKey` and pass `auth.userId` only. Core audience metadata repositories should expose `*ForUser` methods and never query these resources without a tenant predicate.
