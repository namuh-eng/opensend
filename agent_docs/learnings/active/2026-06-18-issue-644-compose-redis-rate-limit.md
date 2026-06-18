---
date: 2026-06-18
issue: "#644"
type: decision
promoted_to: null
---

## Compose defaults Redis, but runtime still requires explicit Redis backend

Docker Compose should be production-like for self-hosters: it starts Redis and
sets the app to `RATE_LIMIT_BACKEND=redis` plus `REDIS_URL=redis://redis:6379`.
The app and ingester wait for Redis health because the Compose defaults depend
on shared Redis for rate limiting and cache coordination.

Outside Compose, keep the runtime contract explicit. Unset
`RATE_LIMIT_BACKEND` remains `disabled` for single-process local development,
and `REDIS_URL` alone must not suppress startup warnings or enable rate
limiting. Operators running more than one app replica should set
`OPENSEND_APP_REPLICAS` and get warned unless `RATE_LIMIT_BACKEND=redis` is
selected.

Do not reintroduce a per-process/memory rate-limit backend as a quiet fallback;
that repeats the original multi-instance safety bug.
