---
date: 2026-05-28
issue: null
type: decision
promoted_to: null
---

## No-op-default DI fields are footguns; required-at-construction + per-package implementations beat shared infra coupling

### What happened
Production domain verification appeared to flip from "pending" to "verified" in Postgres (`/jobs/domain-verify` scheduler reconcile + SES `GetEmailIdentity`) but the dashboard kept showing "Pending" for the full 300s cache TTL window, sometimes longer. Root cause: the ingester used the `domainService` singleton exported at `packages/core/src/services/domain.ts:589`, which was constructed with no dependencies, so the `invalidateDomainCaches` field defaulted to `async () => {}` (line 357). The Next app constructed its own instance with the real invalidator wired in (`src/app/api/domains/route.ts:22-25`), but the ingester reconcile path never invalidated Redis.

### Why this hid for so long
1. The singleton + no-op default looked harmless — TypeScript was satisfied, all the obvious code paths ran without throwing.
2. The verify route at `src/app/api/domains/[id]/verify/route.ts:18` also used the singleton AND manually invalidated cache after the call. That worked "for the wrong reason": the manual call was the only real invalidation; the singleton's internal call no-op'd.
3. The dashboard list view doesn't use the `domain:by-id` cache, so the bug only surfaced on the detail page — and even there, TTL eventually masked it.

### What we considered
- **Move Redis into `@opensend/core`** (rejected — `@opensend/core` is the zero-infra-dep integration package; only `lru-cache` is a hard dep today; pulling in `redis` would force every future core consumer to drag a Redis client).
- **Throw inside the called method when `invalidateDomainCaches` is missing** (rejected — `reconcileAllPendingVerifications` at `packages/core/src/services/domain.ts:551` catches every per-domain error and counts it as `failed++`; a deferred throw would be silently swallowed).
- **Redis-backed scheduler heartbeat** (rejected — writes the signal to the same Redis whose outage we most need to detect; silently returns `"unavailable"` matching `src/lib/cache/redis.ts:112`).
- **SES SNS event-driven verification** (rejected for this PR — SESv2 doesn't expose a clean "identity verified" event stream; would still need polling for initial state + missed events; adds per-region SNS subscriptions; out of scope).

### What we chose
1. **Pure cache-key helpers in `@opensend/core/cache/domain-cache-keys.ts`** — just string functions, zero infra dep. Both Next app and ingester import these so the cache-key contract has one source of truth.
2. **Per-package Redis clients** — app keeps `src/lib/cache/redis.ts`; ingester gets a near-verbatim copy at `packages/ingester/src/cache/redis.ts`. ~80-line wrapper duplicate is acceptable; the keys are what actually matter for correctness.
3. **`invalidateDomainCaches` is REQUIRED at the type level AND at runtime construction.** Factory signature drops the `= {}` default; body explicitly throws when the dep is missing. `createDomainService()` with no args is now a TypeScript compile error.
4. **Deleted `export const domainService` singleton AND `export class DomainService` wrapper.** Both had `async () => {}` no-op defaults. Both are gone. Zero `new DomainService` callers existed repo-wide; the singleton had two callers, both migrated to factory pattern.
5. **`reconcileVerification` invalidates on ALL paths including `unchanged`** — defensive against prior silent invalidation failures. Emits structured debug log `event: "domain.cache.repair_invalidate"` so batch fan-out is observable.
6. **Postgres-backed `scheduler_heartbeats` table** instead of Redis — survives Redis outages, queryable via `psql`. Each row carries its own `interval_ms` in `last_result` JSONB so the health endpoint computes staleness threshold per-job (= `interval_ms × 3`).
7. **Existing log event key `domain.verify.reconcile_completed` is preserved** (just enriched with `changes` array) so any operator dashboards or log queries grepping the old key continue to work.

### Key principle
**Required-at-construction beats optional-with-default for any field whose absence is a silent correctness bug.** The TypeScript `?` marker makes the type honest about runtime behavior, but it shifts the "did you remember to inject this?" question to every call site — and call sites lie when there's a no-op default available. Drop the `?` and the `= {}` default; force the compiler to surface omissions before runtime.

### Operational note for self-hosters
The ingester's `invalidateDomainCaches` implementation is wired to no-op when `REDIS_URL` is unset (matches the app's existing soft-optional Redis posture at `src/lib/cache/redis.ts:49`). One structured warn log fires at module init naming the consequence: `"REDIS_URL unset — domain cache invalidations will be skipped until configured."` Self-hosters running app-only without Redis still work — they lose the dashboard cache benefit but the manual Verify path + cache TTL keep correctness intact.

### Files affected (post-PR)
- NEW `packages/core/src/cache/domain-cache-keys.ts`
- NEW `packages/core/src/jobs/scheduled-jobs.ts`
- NEW `packages/core/src/db/repositories/schedulerHeartbeatRepo.ts`
- NEW `packages/ingester/src/cache/redis.ts`
- NEW `packages/ingester/src/cache/domain-cache.ts`
- NEW `src/app/api/health/scheduler/route.ts`
- NEW Drizzle migration creating `scheduler_heartbeats` table
- `packages/core/src/services/domain.ts` — singleton + class deleted, factory tightened, unchanged-path invalidation added
- `packages/core/src/db/schema.ts` — schedulerHeartbeats table def added
- `packages/core/src/index.ts` — re-exports
- `packages/ingester/src/index.ts` — factory-wired service
- `packages/ingester/src/job-scheduler.ts` — SCHEDULED_JOB_NAMES from core, heartbeat upsert
- `packages/ingester/package.json` — `redis: ^5.12.1`
- `src/lib/domain-cache.ts` — imports keys from core
- `src/app/api/domains/[id]/verify/route.ts` — factory-wired, manual invalidates deleted
- `docker-compose.yml` — `REDIS_URL` in ingester env block
- `.env.example` — ingester REDIS_URL note
- `tests/domain-service.test.ts` — all `createDomainService({...})` callsites updated
- `tests/cache-invalidation-routes.test.ts`, `tests/ingester-ses-route.test.ts` — replace singleton mocks
- New tests: createDomainService throws, round-trip key, heartbeat repo, ingester spy, verify-route spy, E2E

### Consensus trail
Plan went through 3 rounds: Planner → Architect → Critic. v1 was REJECTed on architecture (Redis-in-core, throw-at-call, Redis heartbeat). v2 was REJECTed by Critic (DomainService class bypass, vacuous AC, missing job-name source-of-truth). v3.3 received APPROVE from both reviewers. ADR captured in PR description.

### Follow-ups (not in this PR)
- Codex Rank 2: status-aware TTL on `domain:by-id` — short (10–30s) for `pending`/`not_started`, long (300s) for `verified`.
- Dashboard UI surface for `/api/health/scheduler`.
- `packages/cache` workspace if ingester/app Redis wrapper duplication starts hurting.
- Cache write/delete race resolution (versioned keys or compare-and-set).
- Batch-aware skip flag on `reconcileVerification` if the unchanged-path fan-out shows up as measurable Redis cost.
