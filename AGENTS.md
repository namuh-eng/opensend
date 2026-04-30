# Opensend

## What This Is
Open-source, self-hostable email platform. REST API, TypeScript SDK, React email templates, domain verification (DKIM/SPF/DMARC), webhooks, broadcasts, contacts/segments/topics, and a full admin dashboard. Resend-compatible surface that runs on your own AWS SES quota.

- Repo: `github.com/namuh-eng/opensend`
- License: Elastic License 2.0 (ELv2)
- Primary deploy: Docker Compose for self-hosters; team production runs on **AWS ECS Fargate** (the multi-stage Dockerfile also runs on Cloud Run, Fly, Railway, etc.)

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
- `scripts/` — infra/deploy scripts (gitignored except `start.sh`, `postinstall-star.sh`, `seed.ts`)
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
- `bash scripts/deploy.sh migrate` — team prod: build/push the migrator image and run an ECS one-off migration task only
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
- **Deployment**: Docker Compose is the reference deploy. Team production uses `bash scripts/deploy.sh` (ECS/Fargate); `app`, `ingester`, and `all` run migrations before service redeploy, and `migrate` runs migrations only.

## Security — Secrets Management
- **Never hardcode** passwords, tokens, or API keys in scripts or source.
- **Contributors / local dev**: use `.env` (gitignored).
- **Team production**: secrets live in **AWS Secrets Manager** (region `us-east-1`). Ask Jaeyun or Ashley for the current secret IDs and access.
- Retrieve at runtime:
  ```bash
  aws secretsmanager get-secret-value --secret-id <id> --region us-east-1 --query SecretString --output text
  ```
- `scripts/` is gitignored (except `start.sh`, `postinstall-star.sh`, `seed.ts`) because infra scripts carry environment-specific values. Do not re-commit them.
- **Rate limiting** is enforced via Next.js middleware (`src/middleware.ts`) on all `/api/*` routes with tiered limits (strictest on email sending).

## Team Production — AWS ECS Fargate (namuh.co)
Team prod runs on **ECS Fargate**, not App Runner. App Runner deployment is deprecated and the old `resend-clone-*` resources are being torn down.

- **Region**: `us-east-1`. **Cluster**: `namuh`. **ALB**: `namuh-alb` (shared across all products via host-based listener rules).
- **Subdomain pattern per product**:
  - `<product>.namuh.co` → app/dashboard target group (port 8080)
  - `api.<product>.namuh.co` → app target group (same service handles `/api/*`)
  - `events.<product>.namuh.co` → ingester target group (port 3016)
- **ACM cert** has SANs for `namuh.co`, `*.namuh.co`, `*.opensend.namuh.co`. Add new SANs and re-validate when adding products.
- **DNS authoritative on Cloudflare**, NOT Route53. Zone `namuh.co` ID = `182dba68b02c180d4eb127eb0b025284`. Always use the Cloudflare API for namuh.co records. Do not create Route53 hosted zones for it.
- **Deploy**: `bash scripts/deploy.sh [app|ingester|all|migrate]` — builds/pushes images, runs the migrator ECS task before app/ingester redeploys, force-redeploys selected ECS services, waits until stable. Use `migrate` alone for DB-only repairs.
- **ECR repos**: `<product>-app`, `<product>-ingester`. The app repo also carries the `<tag>-migrator` image built from the Dockerfile `migrator` target. **ECS services**: `<product>-app`, `<product>-ingester`. **Log groups**: `/ecs/<product>-app`, `/ecs/<product>-ingester`.

## Production Gotchas (must-know)
- **Run prod migrations before redeploying app code that expects new columns**: `scripts/deploy.sh` now does this automatically, but never bypass it with a raw `aws ecs update-service` after schema changes. Use `bash scripts/deploy.sh migrate` for DB-only fixes. The migrator image runs `src/lib/db/migrate.ts` via the Drizzle migrator API; avoid switching back to `drizzle-kit migrate` without re-testing in ECS. If a dashboard list page works but a detail page 404s, suspect swallowed DB/schema errors before assuming a missing route.
- **Cloudflare zone ID secret was wrong historically**: `resend-clone/cloudflare/zone-id` previously pointed at the wrong zone (`foreverbrowsing.com`), causing both ACM validation CNAMEs and customer DKIM auto-setup records to be silently written to the wrong zone. Fixed 2026-04-30; verify the secret value matches the namuh.co zone ID before trusting `cloudflare.ts` output.
- **Docker build platform**: Fargate is `linux/amd64`. M-chip Macs default to `arm64`, which silently produces tasks that fail to start. Always `docker buildx build --platform linux/amd64 ... --push`.
- **`bun install` in containers needs `--ignore-scripts`**: postinstall calls `node scripts/install-git-hooks.mjs` which is not present at the `deps` Dockerfile stage. Without `--ignore-scripts` the build fails.
- **Next.js middleware cannot import the `redis` npm package directly**: it pulls in `node:crypto` which is unavailable in the default Edge Runtime, causing every request (including ALB health checks) to 500. Fix is `experimental.nodeMiddleware: true` in `next.config.js` plus `runtime: "nodejs"` on `export const config` in `src/middleware.ts`. Same trap applies to any node-only npm package imported from middleware.
- **`curl` and `wget` are denied** by the agent settings deny-list. For HTTPS calls in scripts, use `bun -e "const r = await fetch(...); console.log(await r.text())"` instead.
- **Long unconditional `sleep` is blocked**. To poll a long-running condition, use `until <check>; do sleep 20; done` and pair it with `run_in_background` so you get a notification when it resolves.
- **`scripts/` is gitignored except for** `start.sh`, `postinstall-star.sh`, `seed.ts`, `install-git-hooks.mjs`, `check-changed-files.mjs`, `deploy.sh`. Anything else under `scripts/` (including `aws-bootstrap.sh`, ad-hoc deploy helpers, task-definition JSON) stays out of git by design — those carry env-specific ARNs.

## Learnings Workflow (namuhflow)
- **Before starting work**: read `agent_docs/learnings/` for prior decisions, mistakes, and patterns.
- **During or after work**: write a learning file under `agent_docs/learnings/active/` for any non-obvious decision, mistake, or pattern. Naming: `YYYY-MM-DD-{issue}-{short-title}.md`, with frontmatter (`date`, `issue`, `type: decision|mistake|pattern`, `promoted_to: null`).
- Promotion: decisions and patterns graduate to `agent_docs/`; mistakes graduate to `CLAUDE.md` / `AGENTS.md` as durable rules. Moved files go to `agent_docs/learnings/archived/`.
- When scope changes mid-implementation or you find `agent_docs/` is inaccurate: spawn the `docs-keeper` agent in the background rather than handling inline.

## Contributing
See `CONTRIBUTING.md` for setup and PR guidelines. `main` prefers PRs; force-push and rebase are used only by team leads during release or cleanup.
