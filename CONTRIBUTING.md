# Contributing

Thanks for your interest in contributing to OpenSend!

## Setup

Two ways to run OpenSend locally. Pick based on what you're doing.

### Recommended for daily dev — hybrid (Postgres in Docker, app on host)

Fast hot-reload, native debugger, logs in your terminal. Requires Docker + [Bun](https://bun.sh).

```bash
git clone https://github.com/namuh-eng/opensend.git
cd opensend
cp .env.example .env
make setup    # starts Postgres, installs deps, pushes schema, seeds DB
make dev      # http://localhost:3015
```

`make setup` runs `docker compose up postgres -d`, waits for it to be ready, installs deps (which also installs the repo's `.githooks` via `core.hooksPath`), pushes the Drizzle schema, and seeds. Only Postgres runs in Docker; the Next.js app runs on your host with Turbopack hot-reload.

If port `3015` is taken, set `PORT=<other>` in `.env`. If `5432` is taken, set `POSTGRES_PORT=<other>` in `.env` and update `DATABASE_URL` to match.

### For verifying the container stack — full Docker

Closest to what self-hosters and prod actually run. Slower iteration (every code change = rebuild), no hot-reload. Use this when prepping a release, testing migrations against the migrator image, or reproducing a self-host issue.

```bash
cp .env.example .env
docker compose up -d
# Dashboard:  http://localhost:3015
# Ingester:   http://localhost:3016
```

Stop with `docker compose down` (add `-v` to wipe the database volume).

### Verify the install

The seed prints an API key — save it. Then:

```bash
# Check the dashboard loads
curl -I http://localhost:3015

# Send a test email (replace YOUR_API_KEY with the seeded key)
curl -X POST http://localhost:3015/api/emails \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "from": "hello@example.com",
    "to": ["test@example.com"],
    "subject": "Hello from OpenSend",
    "text": "It works!"
  }'
```

Without AWS credentials, emails are logged to the console instead of sent — the full API flow still works for development.

To suppress the optional GitHub star prompt during install, use `SKIP_STAR_PROMPT=1 bun install`.
If you install dependencies with `--ignore-scripts`, run `bun run hooks:install` once to enable the local guardrails manually.

<details>
<summary>Manual setup (without make setup)</summary>

1. Copy `.env.example` to `.env`.
2. Start Postgres: `docker compose up postgres -d` (or point `DATABASE_URL` at your own instance). If port `5432` is already taken, set `POSTGRES_PORT` and update `DATABASE_URL` in `.env`.
3. Push schema and seed: `bun run db:push && bun run db:seed`
4. Start dev server: `bun run dev` (set `PORT` in `.env` if `3015` is taken)

</details>

## Development Commands

| Command | Purpose |
|---|---|
| `bun run hooks:install` | Reinstall the versioned Git hooks (`.githooks`) |
| `bun run check` | Run the same change-scoped push guardrails used by `pre-push` |
| `make check` | Run full-repo TypeScript typecheck + Biome lint/format |
| `make test` | Unit tests (Vitest) |
| `make test-e2e` | E2E tests (Playwright, requires dev server) |
| `make all` | Run everything |

Run `make check && make test` before opening a PR.

## Local Git Guardrails

- `pre-commit`: runs `biome check` on staged JS/TS/JSON/CSS/Markdown files for fast feedback before the commit is created.
- `pre-push`: runs `bun run check`, which compares your branch against `origin/main` and blocks the push if any changed files fail lint or typecheck.

The hooks are versioned in `.githooks/`, so everyone on the repo gets the same guardrails after a normal install. `make check` remains available for full-repo validation; the hook stays change-scoped because `origin/main` still has unrelated legacy failures outside most focused PRs.

## Ports

- **3015** — dev server (`bun run dev`)
- **8080** — production Docker image (internal)

## AWS SES (optional for local dev)

AWS credentials are **not required** for local development — without them, emails are logged to the console and the full API flow still works. When you're ready to actually send emails, configure `~/.aws/credentials` via `aws configure`.

New AWS accounts start in SES **sandbox mode** — you can only send to verified addresses. This is an AWS limitation, not an OpenSend bug. See [AWS SES docs](https://docs.aws.amazon.com/ses/latest/dg/request-production-access.html) to request production access.

## Code Style

- **Biome** handles formatting — `make check` auto-reports issues, `bun run lint:fix` fixes them
- **TypeScript strict mode** — no `any`, no type assertions without justification
- Every feature needs at least one unit test (Vitest) and one E2E test (Playwright)

## Pull Requests

- Keep PRs focused — one feature or fix per PR
- Include tests for any new functionality
- Run `make check && make test` before submitting
- Describe the "why" in your PR description, not just the "what"
