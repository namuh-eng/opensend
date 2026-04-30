---
date: 2026-04-30
issue: "prod-domain-404"
type: mistake
promoted_to: AGENTS.md, CLAUDE.md, README.md, docs/ingester-deploy.md
---

## Production domains 404 from migration drift

**What:** Production `/domains/[id]` returned 404 even though domain rows existed. The detail route swallowed DB errors with `notFound()`, hiding that prod was missing columns expected by current Drizzle schema.

**Why:** ECS deploys rebuilt app/ingester services but did not run the Docker migrator target. Prod's Drizzle ledger also lagged behind partially-applied schema changes, so the normal `drizzle-kit migrate` path failed before reaching newer repair migrations.

**Fix:** Run an ECS Fargate migrator task before service redeploys, use the Drizzle migrator API from `src/lib/db/migrate.ts` instead of the flaky CLI path, and keep idempotent repair migrations for historic prod drift.
