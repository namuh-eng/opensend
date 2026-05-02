---
date: 2026-05-02
issue: "#137"
type: pattern
promoted_to: null
---

## Vitest needs explicit workspace aliases for package imports

**What:** The app and tests import `@opensend/core` and deep package paths, but Vitest does not always resolve Bun workspace package links consistently during route-test transforms.
**Why:** Full `make test` can fail on package imports even when TypeScript and Next can resolve them after `bun install`.
**Fix:** Keep explicit Vitest aliases for `@opensend/core` and any used deep imports (for example `@opensend/core/src/webhook-events`) in `vitest.config.ts`, with deep aliases ordered before the package root alias.
