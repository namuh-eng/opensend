---
date: 2026-05-08
issue: "#260"
type: decision
promoted_to: null
---

## MCP first slice uses a local package plus control-plane `/mcp`

Issue #260's first parity slice keeps MCP transport/tool registration in a private workspace package (`@opensend/mcp`) and mounts HTTP mode from `services/api` at `/mcp`. Tool execution forwards to existing stable public API routes with the caller's Bearer API key instead of reusing dashboard cookies or duplicating repository logic.

Why: the control-plane service is already the deployable non-dashboard boundary, while the current public API remains in Next.js. Forwarding preserves existing auth, tenant scoping, validation, quota, SES, and webhook behavior until follow-up thin adapters move more route logic into reusable core services.

Deferred intentionally: public `npx` packaging ownership, received emails, broadcasts, segments, topics, contact properties, and API-key management tools.
