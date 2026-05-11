---
date: 2026-05-11
issue: "#399"
type: pattern
promoted_to: null
---

## Tracking route lookup belongs behind the core service seam

**What:** Public open/click route adapters should mock and call the tracking route service, while tenant-scoped email/domain lookup and domain tracking toggles live in `@opensend/core` behind an injectable repository.
**Why:** Keeping Drizzle queries out of `src/app/api/track/tracking-route.ts` preserves thin HTTP adapters and makes tenant/toggle behavior testable without coupling route tests to database internals.
**Fix:** Add focused service tests for repository scope and toggle gating, then keep route tests on response/event-payload compatibility.
