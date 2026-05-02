# Control-plane API service

`services/api` is the Bun + Hono skeleton for the future OpenSend/Namuh Send control-plane API runtime.

Local development convention:

```bash
bun run dev:api
# service listens on http://localhost:3026 by default
```

Current endpoints:

- `GET /healthz` — service/version health metadata
- `GET /readyz` — static readiness response that does not require AWS, database, queue, or other external credentials

This service is intentionally a skeleton. The existing Next.js route handlers under `src/app/api` remain the current public API until follow-up route-move/thin-adapter PRs move route ownership behind this boundary.

## Thin-adapter pilot pattern

The API keys route family is the first narrow thin-adapter pilot for issue #71:

- `src/app/api/api-keys/**/route.ts` owns only request authorization, JSON/query/route-param parsing, service invocation, and HTTP response mapping.
- `packages/core/src/services/apiKeys.ts` owns API-key business rules: pagination bounds, create validation, token generation/hash/preview construction, repository orchestration, not-found semantics, and cache-invalidation hook invocation.
- The service accepts explicit dependencies, so behavior can be unit-tested without a Next.js request object and later reused by the Hono control-plane runtime.

Follow-up route moves should preserve this split before adding Hono handlers: keep public API shape stable, move business logic into core or a service layer, then let each runtime provide only an adapter.
