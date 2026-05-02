.PHONY: check test test-e2e typecheck lint format fix all dev build clean setup

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

# E2E tests (Playwright — requires dev server running)
test-e2e:
	@echo "→ E2E Tests..." && bunx playwright test && echo "  ✓ E2E Tests passed"

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

# One-command local setup (requires Docker)
setup:
	@test -f .env || (cp .env.example .env && echo "  ✓ Created .env from .env.example")
	@echo "→ Starting Postgres..." && docker compose up postgres -d
	@echo "→ Waiting for Postgres..." && until docker compose exec -T postgres pg_isready -U opensend >/dev/null 2>&1; do sleep 1; done && echo "  ✓ Postgres is ready"
	@echo "→ Installing dependencies and git hooks..." && bun install
	@echo "→ Pushing schema..." && bunx drizzle-kit push --config drizzle.config.ts
	@echo "→ Seeding database..." && bunx tsx scripts/seed.ts
	@echo "\n✓ Setup complete! Run 'make dev' to start the server."

# Clean build artifacts
clean:
	rm -rf .next dist node_modules/.cache
