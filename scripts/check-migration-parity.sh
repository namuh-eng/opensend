#!/usr/bin/env bash
# ABOUTME: Verifies the drizzle migration chain reproduces schema.ts exactly.
# ABOUTME: Compares a migrate-provisioned DB against a push-provisioned DB via catalog queries.
#
# Production provisions the schema by replaying drizzle/*.sql (the migrator ECS
# task runs src/lib/db/migrate.ts); docker-compose self-hosting does the same.
# Dev and CI use drizzle-kit push, which applies schema.ts directly. If the two
# diverge (e.g. the meta snapshot advanced without emitted DDL), only
# migration-provisioned databases break — which is how the api_keys.token_hash
# production outage happened. This script fails when the migration chain does
# not reproduce schema.ts.
#
# Usage: check-migration-parity.sh <migrate_db_url> <push_db_url> <psql_cmd...>
#   psql_cmd is the command prefix used to reach psql, e.g.
#   "docker compose exec -T postgres psql -U opensend"
set -euo pipefail

MIGRATE_DB="$1"
PUSH_DB="$2"
shift 2
PSQL=("$@")

run_sql() {
  local db="$1" sql="$2"
  "${PSQL[@]}" -At -d "$db" -c "$sql"
}

declare -a CHECKS=(
  "tables|SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY 1"
  "columns|SELECT c.table_name||'.'||c.column_name||' '||format_type(a.atttypid,a.atttypmod)||' null='||c.is_nullable||' default='||COALESCE(c.column_default,'-') FROM information_schema.columns c JOIN pg_class cl ON cl.relname=c.table_name AND cl.relnamespace='public'::regnamespace JOIN pg_attribute a ON a.attrelid=cl.oid AND a.attname=c.column_name WHERE c.table_schema='public' ORDER BY 1"
  "indexes|SELECT indexname||' :: '||indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY 1"
  "constraints|SELECT conrelid::regclass::text||'.'||conname||' :: '||pg_get_constraintdef(oid) FROM pg_constraint WHERE connamespace='public'::regnamespace ORDER BY 1"
  "enums|SELECT typname FROM pg_type WHERE typtype='e' AND typnamespace='public'::regnamespace ORDER BY 1"
  "sequences|SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema='public' ORDER BY 1"
)

failed=0
for check in "${CHECKS[@]}"; do
  label="${check%%|*}"
  sql="${check#*|}"
  if diff <(run_sql "$MIGRATE_DB" "$sql") <(run_sql "$PUSH_DB" "$sql") > /tmp/parity-diff.txt; then
    echo "parity OK: $label"
  else
    failed=1
    echo "MIGRATION DRIFT in $label (< migrate-provisioned, > push-provisioned):"
    cat /tmp/parity-diff.txt
  fi
done

if [[ "$failed" -ne 0 ]]; then
  echo
  echo "ERROR: replaying drizzle/*.sql does not reproduce schema.ts."
  echo "Production (which runs migrations) would diverge from dev (which uses db:push)."
  echo "Run 'bun run db:generate', inspect the emitted SQL, and commit it."
  exit 1
fi
echo "Migration chain reproduces schema.ts exactly."
