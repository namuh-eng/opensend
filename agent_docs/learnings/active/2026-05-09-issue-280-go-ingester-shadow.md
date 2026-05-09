---
date: 2026-05-09
issue: 280
type: decision
promoted_to: null
---

## Go ingester skeleton stays outside Compose until parity

**What:** The initial `services/ingester-go` service is documented and buildable, but intentionally not wired into `docker-compose.yml` as a running service.
**Why:** The Bun/Hono `packages/ingester` remains production on port 3016 and still owns SES/SNS, Stripe, scheduled jobs, and webhook fan-out. Adding a Compose service now could look like a supported local replacement before parity exists.
**Pattern:** Keep shadow-only migration skeletons discoverable with their own README, tests, Dockerfile, and top-level docs, but avoid runtime wiring that implies traffic cutover until parity slices explicitly add behavior and deployment ownership.
