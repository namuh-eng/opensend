---
date: 2026-06-12
issue: "#ci/migration-parity-gate"
type: mistake
promoted_to: null
---

## Full schema drift: api_keys was only the tip — ~88 column-level gaps found

**What:** A structured catalog diff (migrate-provisioned DB vs push-provisioned DB) revealed ~88 column-level drifts beyond the api_keys case already recorded. Missing columns span contacts (document, custom_properties, segments, topic_subscriptions), broadcasts (audience_id, document), domains (dkim_tokens, track_clicks, track_opens), emails (status, attachments, headers, document), webhooks (url, event_types, status), and segment counters. Seven enum types existed in the migration chain as legacy varchar(50) or plain enums (broadcast_status, domain_status, email_status, permission_type, topic_default_subscription, topic_visibility, webhook_event). Three junction tables were orphaned (contact_segments, contact_topics, properties). ~10 indexes were absent in the migrated DB, and one FK had ON DELETE CASCADE in migration SQL but not in schema.ts (email_events_email_id_emails_id_fk). Consequence: fresh self-hosted installs via `docker compose` (which run the migrator) were broken. Production was push-shaped so unaffected except api_keys.

**Reverse drift also found:** `inbound_provider_events_primary_event_idx` — a partial unique dedupe index (`WHERE status <> 'duplicate_provider_event'`) — existed only in hand-written migration SQL, not in schema.ts. Push-provisioned DBs (including prod) silently lacked the dedupe guard. Fixed by declaring it in both schema.ts copies with `uniqueIndex().where(sql`...`)`.

**Why:** CI exercised `db:push`, production used the migration chain. Green CI proved nothing about the production schema path. `drizzle-kit generate` validates snapshots, not the SQL — "no schema changes" is fully consistent with broken migration SQL. `pg_dump` diff is the wrong parity tool (column-order and `\restrict` noise); sorted catalog queries are reliable. When migration SQL is hand-authored (partial indexes, custom DDL), those objects must also be declared in schema.ts or push DBs silently omit them.

**Fix:** Shipped on this branch:
- `drizzle/0036_schema_parity_reconciliation.sql` — idempotent full reconciliation from catalog diff; verified: from-zero migrate chain now exactly matches push (tables/columns/indexes/constraints/enums/sequences), idempotent twice on push-shaped DB with data, data-preserving backfills (contacts.properties→custom_properties, webhooks.endpoint→url, webhooks.events→event_types).
- `scripts/check-migration-parity.sh` — structured catalog parity checker.
- New CI job "migration-parity" in `.github/workflows/ci.yml`: provisions two DBs (`bun src/lib/db/migrate.ts` — exact prod migrator entrypoint — vs `drizzle-kit push`) and diffs catalogs.

**Durable rules:**
1. CI must exercise the SAME schema-provisioning path as production. Never let CI use push while prod uses migrations.
2. `drizzle-kit check`/`generate` validate snapshots, NOT the SQL. Never rely on "no changes" as a parity signal.
3. Use sorted catalog queries (not `pg_dump`) for schema parity checks.
4. Any object hand-authored in migration SQL (partial indexes, custom DDL) MUST also be declared in schema.ts.
