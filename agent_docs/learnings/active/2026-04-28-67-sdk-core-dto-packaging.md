---
date: 2026-04-28
issue: "#67"
type: decision
promoted_to: null
---

## Bundle core DTO declarations into the SDK build output

**What:** The SDK now sources its exported HTTP DTO types from `packages/core/src/dto/index.ts`, and the SDK TypeScript build includes that DTO source so the published `dist/` stays self-contained.

**Why:** A thin publishable SDK should not duplicate request/response shapes in `packages/sdk/src/index.ts`, but it also cannot ship declaration files that reference a private workspace package consumers do not install.

**Fix:** Keep SDK DTOs in `@opensend/core`, import them by source path inside the monorepo, and compile the DTO source into `packages/sdk/dist/core/...` alongside the SDK declaration output.
