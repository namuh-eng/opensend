---
date: 2026-06-18
issue: "#641"
type: decision
promoted_to: null
---

## Keep shared env bootstrap helpers on the existing core deep-import pattern

Issue #641 adds shared env generation and boot preflight helpers under
`packages/core/src/env.ts`. App, ingester, tests, and the setup command import it
as `@opensend/core/src/env`, matching existing deep imports such as
`@opensend/core/src/webhook-events`.

Adding a new package `exports` subpath for `@opensend/core/env` made TypeScript
stop resolving existing `@opensend/core/src/*` imports during `make check`, and
Vitest also needs explicit aliases for core deep imports. Keep the env helper on
this established path unless the repo migrates all core imports and aliases
coherently.
