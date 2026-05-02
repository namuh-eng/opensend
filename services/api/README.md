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

This service is intentionally a skeleton. The existing Next.js route handlers under `src/app/api` remain the current public API until follow-up thin-adapter PRs move route ownership behind this boundary.
