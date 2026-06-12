---
date: 2026-06-12
issue: "OPENSEND-WEB-3/4"
type: mistake
promoted_to: null
---

## Drizzle meta snapshot advanced without emitting DDL

**What:** `packages/core/src/db/schema.ts` was restructured (api_keys legacy columns replaced with token_hash shape) and the Drizzle meta snapshot recorded the new shape (from snapshot 0001 onward), but no migration .sql file was ever generated for those DDL changes. Migrator-provisioned databases (production) retained the old columns and lacked `token_hash`, causing every API-key-authenticated request to fail with "column does not exist". `db:push` and fresh installs were unaffected because push applies the schema directly.

**Why:** The drift is invisible until production: `drizzle-kit generate` reports "no changes" (because the snapshot already matches schema.ts), while the actual database is missing columns. Sentry surfaced it as a failed query on GET /api/emails/[id].

**Fix:** Hand-authored `drizzle/0035_reconcile_api_keys.sql` (idempotent ADD COLUMN / backfill / DROP COLUMN / NOT NULL + unique index) and registered it in `drizzle/meta/_journal.json`. Going forward: after every edit to `schema.ts`, run `bun run db:generate` and confirm a non-empty .sql migration file is produced before committing. If `drizzle-kit generate` says "no changes" but you changed the schema, the snapshot is already ahead of the SQL — stop and reconcile manually.
