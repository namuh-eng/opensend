# Opensend

## What This Is
Open-source, self-hostable email platform. REST API, TypeScript SDK, React email templates, domain verification (DKIM/SPF/DMARC), webhooks, broadcasts, contacts/segments/topics, and a full admin dashboard. Resend-compatible surface that runs on your own AWS SES quota.

- Repo: `github.com/namuh-eng/opensend`
- License: Elastic License 2.0 (ELv2)
- Primary deploy: Docker Compose for self-hosters (the multi-stage Dockerfile also runs on Cloud Run, Fly, Railway, ECS, etc.)

## Tech Stack
- **Framework**: Next.js 16 (App Router, Turbopack) — pre-installed, do not change
- **Language**: TypeScript strict mode, no `any` types
- **Styling**: Tailwind CSS + Radix UI
- **Auth**: Better Auth with Google OAuth (multi-tenant)
- **Database**: PostgreSQL + Drizzle ORM
- **Email**: AWS SES v2 (`@aws-sdk/client-sesv2`)
- **Storage**: AWS S3
- **DNS**: Cloudflare API (DKIM/SPF/DMARC auto-setup)
- **Webhooks**: Svix-compatible headers + HMAC signing
- **Unit Tests**: Vitest
- **E2E Tests**: Playwright (pre-configured)
- **Linting**: Biome (pre-configured)

## Repo Layout (monorepo, Bun workspaces)
- `src/` — main Next.js app
  - `src/app/` — App Router pages and API routes, with `(dashboard)` segment + `auth/`, `docs/`
  - `src/components/` — React UI components
  - `src/lib/` — `auth.ts`, `auth-client.ts`, `api-auth.ts`, `db/`, `ses.ts`, `s3.ts`, `cloudflare.ts`, `webhook-signing.ts`, `date-range.ts`
  - `src/middleware.ts` — per-route rate limiting
- `packages/core/` — `@opensend/core` — shared DB client, repositories, DTOs, webhook helpers
- `packages/ingester/` — `@opensend/ingester` — Hono webhook dispatcher for SES/SNS events and scheduled email worker
- `packages/sdk/` — `opensend` — public TypeScript SDK published to npm
- `tests/` — Vitest unit tests
- `tests/e2e/` — Playwright E2E tests
- `drizzle/` — generated migration SQL
- `scripts/` — infra/deploy scripts (most entries gitignored to keep environment-specific values out of the repo)
- `agent_docs/learnings/` — decisions, mistakes, patterns captured by `/shipit`, `/retro`, the `docs-keeper` agent
- `docs/assets/` — README images (`screenshot-dashboard.png` only; don't add orphans)

## Commands
- `make check` — typecheck + Biome
- `make test` — Vitest unit tests
- `make test-e2e` — Playwright (requires `bun run dev` running on port 3015)
- `make all` — check + test
- `bun run dev` — Next.js dev server on port 3015
- `bun run build` — production build
- `bun run db:generate` — Drizzle migration files
- `bun run db:migrate` — apply migrations for the configured `DATABASE_URL`
- `bun run db:push` — push schema (dev)
- `bun run db:seed` — seed sample data
- `docker compose up -d` — full stack with Postgres + auto-migration

## Quality Standards
- TypeScript strict mode, no `any` types
- Every feature: at least one Vitest unit test AND at least one Playwright E2E test
- Run `make check && make test` before every commit
- Small, focused commits — one feature per commit

## Pre-configured (do not reinstall or recreate)
- **Playwright** — `playwright.config.ts`, `tests/e2e/`
- **Biome** — `biome.json`
- **Makefile** — `make check`, `make test`, `make test-e2e`, `make all`
- **Drizzle** — `drizzle.config.ts`, migrations in `drizzle/`
- **Docker** — multi-stage `Dockerfile`, `docker-compose.yml` (app + postgres + migrate service)

## Environment
- **AWS CLI** is pre-configured via `~/.aws/credentials`. `aws` commands and `@aws-sdk/*` packages work out of the box. Use `us-east-1` for SES.
- `.env` keys (see `.env.example` for the contributor-facing set):
  - `DATABASE_URL` — Postgres connection string
  - `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ZONE_ID` — DNS management
  - `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_REGION` — SES + S3
  - `S3_BUCKET_NAME` — email attachment storage
  - Google OAuth client credentials for Better Auth
- **Deployment**: Docker Compose is the reference deploy. The standalone ingester service (`packages/ingester/`) handles SES/SNS event ingestion — point SES SNS topics at the ingester's `/events/ses` endpoint, not the app URL.

## Security — Secrets Management
- **Never hardcode** passwords, tokens, or API keys in scripts or source.
- **Local dev**: use `.env` (gitignored). Production deployments should source secrets from a secrets manager (AWS Secrets Manager, Doppler, Vault, etc.) and inject them at runtime.
- `scripts/` is largely gitignored because infra scripts carry environment-specific values. Do not re-commit them.
- **Rate limiting** is enforced via Next.js middleware (`src/middleware.ts`) on all `/api/*` routes with tiered limits (strictest on email sending).

## Production Gotchas (must-know)
- **Run migrations before redeploying app code that expects new columns**. The migrator runs `src/lib/db/migrate.ts` via the Drizzle migrator API. If a dashboard list page works but a detail page 404s, suspect swallowed DB/schema errors before assuming a missing route.
- **Docker build platform**: production typically runs `linux/amd64`. M-chip Macs default to `arm64`, which silently produces images that fail to start. Always `docker buildx build --platform linux/amd64 ... --push`.
- **`bun install` in containers needs `--ignore-scripts`**: postinstall calls `node scripts/install-git-hooks.mjs` which is not present at the `deps` Dockerfile stage. Without `--ignore-scripts` the build fails.
- **Next.js middleware cannot import the `redis` npm package directly**: it pulls in `node:crypto` which is unavailable in the default Edge Runtime, causing every request (including health checks) to 500. Fix is `experimental.nodeMiddleware: true` in `next.config.js` plus `runtime: "nodejs"` on `export const config` in `src/middleware.ts`. Same trap applies to any node-only npm package imported from middleware.
- **`curl` and `wget` are denied** by the agent settings deny-list. For HTTPS calls in scripts, use `bun -e "const r = await fetch(...); console.log(await r.text())"` instead.
- **Long unconditional `sleep` is blocked**. To poll a long-running condition, use `until <check>; do sleep 20; done` and pair it with `run_in_background` so you get a notification when it resolves.

## Learnings Workflow (namuhflow)
- **Before starting work**: read `agent_docs/learnings/` for prior decisions, mistakes, and patterns.
- **During or after work**: write a learning file under `agent_docs/learnings/active/` for any non-obvious decision, mistake, or pattern. Naming: `YYYY-MM-DD-{issue}-{short-title}.md`, with frontmatter (`date`, `issue`, `type: decision|mistake|pattern`, `promoted_to: null`).
- Promotion: decisions and patterns graduate to `agent_docs/`; mistakes graduate to `CLAUDE.md` / `AGENTS.md` as durable rules. Moved files go to `agent_docs/learnings/archived/`.
- When scope changes mid-implementation or you find `agent_docs/` is inaccurate: spawn the `docs-keeper` agent in the background rather than handling inline.

## Contributing
See `CONTRIBUTING.md` for setup and PR guidelines. `main` prefers PRs; force-push and rebase are used only by team leads during release or cleanup.
