<p align="center">
  <h1 align="center">Opensend</h1>
  <p align="center">
    Open-source email infrastructure for developers.
    <br />
    Send transactional emails, manage domains, build broadcasts — all self-hosted.
  </p>
  <p align="center">
    <a href="https://github.com/namuh-eng/opensend/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-ELv2-blue" alt="License" /></a>
    <a href="https://github.com/namuh-eng/opensend/stargazers"><img src="https://img.shields.io/github/stars/namuh-eng/opensend?style=social" alt="GitHub Stars" /></a>
    <a href="https://github.com/namuh-eng/opensend/issues"><img src="https://img.shields.io/github/issues/namuh-eng/opensend" alt="Issues" /></a>
  </p>
</p>

<p align="center">
  <a href="#one-click-deploy">Deploy</a> ·
  <a href="#features">Features</a> ·
  <a href="#api-quickstart">API</a> ·
  <a href="#self-hosting">Self-Hosting</a> ·
  <a href="./CONTRIBUTING.md">Contributing</a>
</p>

<p align="center">
  <img src="docs/assets/screenshot-dashboard.png" alt="Opensend Dashboard" width="800" />
</p>

---

## What is Opensend?

Opensend is a **self-hostable email platform** that gives you the same developer experience as Resend — REST API, TypeScript SDK, React email templates, domain verification, webhooks, and a full dashboard — running on your own infrastructure.

**Use it if you want:**
- Full control over your email infrastructure
- No per-email pricing — send as much as your SES quota allows
- A drop-in Resend-compatible API for your existing code
- An admin dashboard for domains, templates, broadcasts, automations, and analytics

## Two ways to use Opensend

| | **Opensend Cloud** | **Self-host** |
|---|---|---|
| Where it runs | Managed at `opensend.namuh.co` | Your infrastructure |
| Setup | Sign in with Google, add a domain | `docker compose up -d` |
| Pricing | Free tier with 10k sends/mo, paid plans from $19/mo | Free; you pay AWS SES |
| Best for | Teams that want zero ops | Teams that want full control |

> Opensend Cloud is in early access. Pricing tiers (Starter / Growth / Scale) are wired through Stripe; the Free tier needs no card.

## One-Click Deploy

The fastest way to get Opensend running:

```bash
git clone https://github.com/namuh-eng/opensend.git
cd opensend
cp .env.example .env
# Edit .env — AWS credentials are only needed for real email sending
docker compose up -d
```

That's it. Open **http://localhost:3015** and sign in with Google (configure `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` in `.env`).

> The `migrate` service runs database migrations automatically on first boot. Compose also launches the standalone ingester on port `3016` (`http://localhost:3016/health`) for SES/SNS events and background workers.
>
> Outside Docker Compose, migrations are not automatic — your deploy path needs to run the `migrator` Dockerfile target (or `bun run db:migrate`) before rolling out app code that expects new columns. See [`docs/self-hosting.md`](docs/self-hosting.md#upgrades--migrations).

## Features

- **REST API** — Send emails via a simple POST request with API key auth, including a `/api/emails/batch` endpoint for bulk sends
- **Idempotency Keys** — Opt-in `Idempotency-Key` header (or per-row keys on batch sends) so retries collapse safely
- **TypeScript SDK** — [`opensend`](./packages/sdk) npm package with full type safety
- **Python SDK** — [`opensend`](./packages/python-sdk) package with a Resend-shaped transactional email surface
- **React Email Templates** — Pass React components via the SDK's `react` prop
- **Domain Verification** — DKIM, SPF, DMARC records auto-written to Cloudflare DNS, with click-tracking subdomains and custom return paths supported
- **API Key Management** — `full_access` and `sending_access` permission scopes
- **Broadcasts** — Block editor with slash commands, audience targeting, review panel
- **Automations** — Multi-step flows triggered by contact updates and custom events, executed by the ingester worker
- **Templates** — Create, edit, publish with variable substitution (`{{name}}`)
- **Audience** — Contacts, segments, topics, custom properties, plus CSV import
- **Suppressions** — Per-tenant suppression list at `/api/suppressions` so bounces and complaints stop future sends automatically
- **Inbound Email** — Receive replies through `/api/emails/receiving`
- **Webhooks** — Register endpoints with HMAC-signed, Svix-compatible delivery. Event types include `email.accepted`, `email.sent`, `email.delivered`, `email.opened`, `email.clicked`, `email.bounced`, `email.complained`, `email.delivery_delayed`, `email.failed`, plus batch and quota variants. Event list is free-form, so additional types can be added without schema changes.
- **Multi-tenant Auth** — Better Auth with Google OAuth, organization invites via `/api/invites`
- **Metrics & Usage** — Delivery, open, click, bounce rates with date range filtering, plus per-tenant usage at `/api/usage`
- **Logs** — Full send/delivery/event audit trail
- **Health Check** — `/api/health` for uptime probes
- **API Docs** — Auto-generated interactive docs at `/docs`
- **Dashboard** — 10-page admin UI with dark mode

## API Quickstart

### Send an email

```bash
curl -X POST http://localhost:3015/api/emails \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "from": "hello@yourdomain.com",
    "to": ["recipient@example.com"],
    "subject": "Hello from Opensend",
    "html": "<h1>It works!</h1>"
  }'
```

Open `http://localhost:3015/docs` for the full local API reference.

### Control-plane API skeleton

This repository now includes a dedicated TypeScript control-plane API service skeleton at [`services/api`](./services/api). It runs on Bun + Hono and reserves local development port **3026**:

```bash
bun run dev:api
curl http://localhost:3026/healthz
curl http://localhost:3026/readyz
```

For now, the Next.js routes under `src/app/api` remain the current public API and own production request handling. The control-plane service only exposes health/readiness endpoints until follow-up thin-adapter PRs move route ownership behind this boundary.

### TypeScript SDK

```bash
bun add opensend
```

```typescript
import { Opensend } from "opensend";

const client = new Opensend("YOUR_API_KEY", {
  baseUrl: "https://your-deployment.example.com",
});

const { data } = await client.emails.send({
  from: "hello@yourdomain.com",
  to: "recipient@example.com",
  subject: "Hello from Opensend",
  html: "<h1>It works!</h1>",
});

console.log("Queued email", data?.id);
```

Full SDK docs: [`packages/sdk/README.md`](./packages/sdk/README.md)

### Python SDK

```bash
python -m pip install ./packages/python-sdk
```

```python
import os
import opensend

opensend.api_key = os.environ["OPENSEND_API_KEY"]
opensend.base_url = os.environ.get("OPENSEND_BASE_URL", "https://api.opensend.com")

email = opensend.Emails.send({
    "from": "hello@yourdomain.com",
    "to": "recipient@example.com",
    "subject": "Hello from Opensend",
    "html": "<h1>It works!</h1>",
})

print("Queued email", email["id"])
```

Full Python SDK docs: [`packages/python-sdk/README.md`](./packages/python-sdk/README.md) and [`docs/sdk/python.md`](./docs/sdk/python.md)

## Self-Hosting

### Requirements

- Docker & Docker Compose
- AWS account with SES access (for sending real emails — local dev works without it)
- *(Optional)* Cloudflare account for automatic DKIM/SPF/DMARC setup

### Docker Compose (recommended)

```bash
git clone https://github.com/namuh-eng/opensend.git
cd opensend
cp .env.example .env
# Edit .env — at minimum set BETTER_AUTH_SECRET and (for sending) AWS credentials
docker compose up -d
```

This starts PostgreSQL, runs migrations, launches the app on `:3015`, and the
standalone SES/SNS ingester on `:3016`. Open **http://localhost:3015** for the
dashboard/API and `http://localhost:3016/health` for the ingester.

### Manual setup (without Docker)

Requires [Bun](https://bun.sh) and a running Postgres instance:

```bash
git clone https://github.com/namuh-eng/opensend.git
cd opensend
bun install
cp .env.example .env
bun run db:push
bun run db:seed          # Optional: sample data
bun run dev              # Development on port 3015
# or
bun run build && bun start
```

### Production deployments

For production setup — managed Postgres, AWS SES IAM, S3 attachments, reverse
proxy + TLS, SQS-backed background jobs, Redis rate limiting, observability,
and the split app/ingester service shape — read the dedicated guides:

- **[`docs/self-hosting.md`](docs/self-hosting.md)** — full self-hosting deep dive (environment variables, database, SES, DNS, auth, reverse proxy, background jobs, Redis, upgrades, troubleshooting)
- **[`docs/ingester-deploy.md`](docs/ingester-deploy.md)** — running the ingester as a separate service with SNS cutover and replay runbook
- **[`docs/observability.md`](docs/observability.md)** — log/metric/trace catalog and the API-to-provider tracing runbook

The included multi-stage `Dockerfile` builds the app, the migrator, and (via
`packages/ingester/Dockerfile`) the ingester. Images run on any container
platform — ECS Fargate, Google Cloud Run, Fly.io, Railway, Kubernetes, or a
plain Docker host.

```bash
docker build -t opensend .
docker run -p 3015:8080 --env-file .env opensend
```

## Architecture

Opensend is a Bun workspace monorepo. The Next.js app and a standalone Hono ingester service share a typed core package.

```
src/                 # Next.js app (App Router)
├── app/             # Pages, dashboard segment, API routes
├── components/      # React UI
├── lib/             # auth, api-auth, db, ses, s3, cloudflare,
│                    # webhook-signing, cache, crypto, templates,
│                    # validation, workers, events, domain-cache,
│                    # email-attachments, date-range
└── middleware.ts    # Per-route rate limiting

packages/
├── core/            # @opensend/core — shared DB client, repos, DTOs, webhook helpers
├── ingester/        # @opensend/ingester — Hono service for SES/SNS events,
│                    #   scheduled-email worker, webhook retry scan (port 3016)
├── sdk/             # opensend — published TypeScript SDK
└── python-sdk/      # opensend — first-party Python SDK package

tests/               # Vitest unit tests
tests/e2e/           # Playwright E2E tests
drizzle/             # Generated migration SQL
```

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript (strict mode) |
| Styling | Tailwind CSS + Radix UI |
| Auth | Better Auth (multi-tenant, Google OAuth) |
| Database | PostgreSQL + Drizzle ORM |
| Email | AWS SES v2 |
| Storage | AWS S3 |
| DNS | Cloudflare API |
| Billing (Cloud) | Stripe |
| Ingester | Hono on Bun (standalone service) |
| Background Jobs | AWS SQS + EventBridge |
| Cache / Rate Limit | Redis (TLS) |
| Tests | Vitest + Playwright |
| Linting | Biome |

## Development

For local contributor onboarding, use the same Docker-backed path as [CONTRIBUTING.md](./CONTRIBUTING.md):

```bash
cp .env.example .env
make setup    # starts Postgres, installs deps, pushes schema, seeds DB
make dev      # http://localhost:3015
```

`make setup` uses the host-machine `DATABASE_URL` from `.env` (`localhost` by default). Docker Compose app and migration containers use their own internal `postgres` hostname automatically.
`bun install` also installs the repo's versioned Git hooks automatically by setting `core.hooksPath` to `.githooks`.

```bash
bun run hooks:install  # optional manual reinstall if you used --ignore-scripts
bun run check          # runs the same change-scoped push guardrail used on pre-push
make check             # full repo typecheck + lint
make test              # Unit tests
make test-e2e          # E2E tests (sources .env; Playwright starts dev server)
make all               # Everything
```

Local guardrails:

- `pre-commit` runs Biome on staged JS/TS/JSON/CSS/Markdown files for quick feedback.
- `pre-push` runs `bun run check`, which checks only the files changed from `origin/main` and blocks the push if those changed files fail lint or typecheck.

`make check` still runs the full repo validation. The push hook stays change-scoped because the current upstream branch still has unrelated legacy lint/typecheck failures outside this PR's scope.

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the full development guide.

## Roadmap

- [x] Webhook signature verification (Svix-compatible HMAC headers)
- [x] Email scheduling (EventBridge → SQS scheduled-email scan)
- [x] Team support (multi-tenant auth + organization invites)
- [x] Built-in open/click analytics without external dependencies
- [x] Additional webhook event types (opened, clicked, complained, delivery_delayed)
- [ ] SMTP relay support (send without AWS SES)

## Contributing

We welcome contributions! See [CONTRIBUTING.md](./CONTRIBUTING.md) for setup instructions and guidelines.

## License

[Elastic License 2.0](./LICENSE) — free to use, modify, and self-host. The only restriction: you cannot offer Opensend as a hosted email service to third parties.

---

<p align="center">
  Built by <a href="https://github.com/jaeyunha">Jaeyun Ha</a> and <a href="https://github.com/ashley-ha">Ashley Ha</a>
</p>
