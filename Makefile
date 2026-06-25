.PHONY: check test test-e2e typecheck lint format fix all dev build clean setup db _db-heal cli-build cli-test cli-check go-all bench

# Go CLI version (override with make cli-build VERSION=1.2.3)
VERSION ?= dev

# Postgres volume/container names (compose project `opensend-staging`).
PG_VOLUME = opensend-staging_pgdata
PG_CONTAINER = opensend-staging-postgres-1

# Full validation: check + test
all: check test

# Static analysis: typecheck + lint/format
check: typecheck lint

# TypeScript type checking
typecheck:
	@echo "→ TypeCheck..." && bunx tsc --noEmit && echo "  ✓ TypeCheck passed"

# Lint and format check (Biome)
lint:
	@echo "→ Lint & Format..." && bunx biome check . && echo "  ✓ Lint & Format passed"

# Auto-fix lint and format issues
fix:
	bunx biome check --write .

format:
	bunx biome format --write .

# Unit tests (Vitest)
test:
	@echo "→ Unit Tests..." && bunx vitest run && echo "  ✓ Unit Tests passed"

# E2E tests (Playwright — sources .env and starts/reuses dev server)
test-e2e:
	@echo "→ E2E Tests..." && if [ -f .env ]; then set -a; . ./.env; set +a; fi; bunx playwright test && echo "  ✓ E2E Tests passed"

# Dev server
dev:
	bun run dev

# Production build
build:
	bun run build

# Database migrations
db-generate:
	bunx drizzle-kit generate --config drizzle.config.ts

db-migrate:
	bunx drizzle-kit migrate --config drizzle.config.ts

db-push:
	bunx drizzle-kit push --config drizzle.config.ts

# Start only Postgres for local dev (app runs natively via `make dev`).
db: _db-heal
	@echo "→ Starting Postgres..." && docker compose up postgres -d
	@if [ -f .env ]; then set -a; . ./.env; set +a; fi; echo "  ✓ Postgres up on port $${POSTGRES_PORT:-5432}"

# Remove a stale postmaster.pid left by an unclean shutdown — but ONLY when
# Postgres is not running, so a live database is never touched. No-op if the
# volume/container don't exist yet (fresh machine).
_db-heal:
	@if [ -z "$$(docker ps -q -f name=$(PG_CONTAINER) -f status=running)" ]; then \
		docker run --rm -v $(PG_VOLUME):/var/lib/postgresql/data postgres:16-alpine \
			sh -c 'rm -f /var/lib/postgresql/data/postmaster.pid' >/dev/null 2>&1 || true; \
	fi

# One-command local setup (requires Docker)
setup: _db-heal
	@test -f .env || (cp .env.example .env && echo "  ✓ Created .env from .env.example")
	@echo "→ Starting Postgres..." && docker compose up postgres -d
	@echo "→ Waiting for Postgres..." && until docker compose exec -T postgres pg_isready -U opensend >/dev/null 2>&1; do sleep 1; done && echo "  ✓ Postgres is ready"
	@echo "→ Installing dependencies and git hooks..." && bun install
	@echo "→ Pushing schema..." && bunx drizzle-kit push --config drizzle.config.ts
	@echo "→ Seeding database..." && bunx tsx scripts/seed.ts
	@echo "\n✓ Setup complete! Run 'make dev' to start the server."

# ── Go CLI ───────────────────────────────────────────────────────────────────

CLI_MODULE = github.com/namuh-eng/opensend/services/opensend-cli/internal/version

# Build the opensend binary into bin/opensend.
# Override version: make cli-build VERSION=1.2.3
cli-build:
	@mkdir -p bin
	@echo "→ Building opensend CLI..."
	cd services/opensend-cli && go build \
		-ldflags "-X $(CLI_MODULE).Version=$(VERSION) \
		          -X $(CLI_MODULE).Commit=$(shell git rev-parse --short HEAD) \
		          -X $(CLI_MODULE).BuildDate=$(shell date -u +%Y-%m-%dT%H:%M:%SZ)" \
		-o ../../bin/opensend ./
	@echo "  ✓ bin/opensend built"

# Run Go unit tests.
cli-test:
	@echo "→ Go Tests..." && cd services/opensend-cli && go test ./... && echo "  ✓ Go Tests passed"

# Vet + test (used in CI).
cli-check:
	@echo "→ Go Vet..." && cd services/opensend-cli && go vet ./... && echo "  ✓ Go Vet passed"
	@$(MAKE) cli-test

# Aggregate target: run all Go checks.
go-all: cli-check

# ── Benchmarks ───────────────────────────────────────────────────────────────

# Run Go + Bun benchmarks, capture output to bench/results/<timestamp>.txt
bench:
	@mkdir -p bench/results
	@TS=$$(date -u +%Y%m%dT%H%M%SZ); OUT=bench/results/$$TS.txt; \
	echo "=== Bun vs Go Worker Benchmark — $$(date -u) ===" | tee $$OUT; \
	echo "" | tee -a $$OUT; \
	echo "--- Go (services/opensend-cli/internal/bench) ---" | tee -a $$OUT; \
	cd services/opensend-cli && go test -bench=. -benchmem -benchtime=3s ./internal/bench/ 2>&1 | tee -a ../../$$OUT; \
	cd ../..; \
	echo "" | tee -a $$OUT; \
	echo "--- Bun (bench/bun-worker-bench.test.ts) ---" | tee -a $$OUT; \
	bun test ./bench/bun-worker-bench.test.ts 2>&1 | tee -a $$OUT; \
	echo "" | tee -a $$OUT; \
	echo "Output written to $$OUT"

# ── Cleanup ───────────────────────────────────────────────────────────────────

# Clean build artifacts
clean:
	rm -rf .next dist node_modules/.cache bin/opensend
