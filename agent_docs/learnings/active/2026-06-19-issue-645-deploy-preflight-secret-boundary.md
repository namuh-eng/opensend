---
date: 2026-06-19
issue: 645
type: pattern
promoted_to: null
---

## Deploy fallback preflight must be stricter than task registration side effects

When a fallback deploy script can resolve Secrets Manager IDs while preparing ECS task definitions, the non-mutating preflight should check every production-required secret metadata reference with `describe-secret` before any image push, task registration, migration task, or service update can happen.

For PR #667, this means checking webhook secret encryption, tracking, ingester job token, and ingester inbound token metadata. The preflight must never call `get-secret-value` or print secret values; secret names/IDs and metadata lookup failures are safe to log.
