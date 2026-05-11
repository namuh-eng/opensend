---
date: 2026-05-12
issue: "#417"
type: decision
promoted_to: null
---

## Keep domain provider wiring inside core service defaults

Issue #417 removed the remaining direct SES/Cloudflare imports from the Next domain route adapters. The route adapters should stay responsible for auth, validation, quota, audit, events, and response/status mapping only.

Domain provider side effects now enter through core defaults: `domainIdentityProvider` backs domain create/reconcile/delete identity calls, and `cloudflareDnsCleanupProvider` backs best-effort DNS cleanup during domain delete. Routes may still inject cache helpers (`getCachedDomainById`, `invalidateDomainCaches`) because those are adapter/cache concerns, but they should not inject raw provider SDK functions.

When changing domain provider behavior, add/adjust service tests for the core boundary first, then keep route tests focused on compatibility and the absence of provider injection from the adapter.
