<p align="center">
  <h1 align="center">OpenSend</h1>
  <p align="center">
    Source-available email infrastructure for developers who want to self-host.<br />
    Run a familiar email API, admin dashboard, webhooks, and SES-backed delivery on your own AWS quota.
  </p>
  <p align="center">
    <a href="https://github.com/namuh-eng/opensend/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-ELv2-blue" alt="License" /></a>
    <a href="https://github.com/namuh-eng/opensend/stargazers"><img src="https://img.shields.io/github/stars/namuh-eng/opensend?style=social" alt="GitHub Stars" /></a>
    <a href="https://github.com/namuh-eng/opensend/issues"><img src="https://img.shields.io/github/issues/namuh-eng/opensend" alt="Issues" /></a>
  </p>
</p>

<p align="center">
  <a href="#quick-start">Quick start</a> ·
  <a href="#why-developers-self-host-opensend">Why self-host</a> ·
  <a href="#features">Features</a> ·
  <a href="#docs-and-llm-ready-reference">Docs</a> ·
  <a href="#api-quickstart">API</a> ·
  <a href="#self-hosting">Self-hosting</a> ·
  <a href="./CONTRIBUTING.md">Contributing</a>
</p>

<p align="center">
  <img src="docs/assets/screenshot-dashboard.png" alt="OpenSend Today dashboard showing delivery metrics and live activity" width="900" />
</p>

---

## What is OpenSend?

OpenSend is a self-hostable email platform with REST APIs, SDKs, React email templates, domain verification, webhooks, broadcasts, automations, analytics, and an admin dashboard.

Self-hosted OpenSend runs on your infrastructure and your AWS SES account. The default self-hosted stack does not phone home to OpenSend, Namuh, Sentry, PostHog, or any license server unless you explicitly configure those integrations.

OpenSend is source-available under the [Elastic License 2.0](./LICENSE): you can use, modify, and self-host it, but you cannot offer OpenSend itself as a competing hosted email service.

## Why developers self-host OpenSend

- **Own the data boundary**: keep API traffic, recipient data, delivery events, and webhook secrets inside infrastructure you control.
- **Use your SES quota**: send through AWS SES with OpenSend's dashboard, API keys, SDKs, webhooks, audiences, broadcasts, and templates on top.
- **Inspect the whole path**: app, API routes, database schema, ingester, scheduler, webhook signing, docs, and generated OpenAPI all live in this repo.
- **Start with Compose**: `cp .env.example .env && docker compose up -d` brings up Postgres, migrations, app, ingester, and scheduler.
- **Stay telemetry-explicit**: self-hosted deployments make zero outbound calls to OpenSend-operated vendors unless you set the relevant env vars.

## Cloud or self-hosted

|               | OpenSend Cloud                         | Self-host                                     |
| ------------- | -------------------------------------- | --------------------------------------------- |
| Where it runs | Managed at `opensend.namuh.co`         | Your infrastructure                           |
| Fastest setup | Sign in with Google and add a domain   | `docker compose up -d`                        |
| Cost model    | Free tier, paid plans for hosted usage | Free software; you pay AWS SES/infrastructure |
| Best for      | Teams that want zero ops               | Teams that want full control                  |

> OpenSend Cloud is in early access. The Free tier needs no card; paid tiers are wired through Stripe.

## Quick start

The fastest local path is Docker Compose:

```bash
git clone https://github.com/namuh-eng/opensend.git
cd opensend
cp .env.example .env
docker compose up -d
```

Open **http://localhost:3015**.

The checked-in `BETTER_AUTH_SECRET`, `INGESTER_JOB_TOKEN`, and `WEBHOOK_SECRET_ENCRYPTION_KEY` values in `.env.example` are local-only placeholders so the stack can boot for localhost evaluation. Replace them with `openssl rand -hex 32` values before any shared, staging, or production deploy; the app and ingester refuse the local auth placeholder when the configured app URL is not localhost.

Compose starts:

- `app`: Next.js dashboard and public API on `:3015`
- `postgres`: local database
- `migrate`: one-shot schema migration runner
- `ingester`: SES/SNS ingestion and workers on `:3016`
- `scheduler`: scheduled job trigger sidecar

For real email delivery, add AWS SES credentials and verify a sending domain. For dashboard login, add Google OAuth credentials.

For local development without the full app container:

```bash
cp .env.example .env
make setup    # starts Postgres, installs deps, pushes schema, seeds data
make dev      # http://localhost:3015
```

## Features

- **REST API**: send single or batch emails with API-key auth and idempotency keys.
- **OpenSend-first familiar API**: transactional sends, audiences/contacts, suppressions, webhooks, and migration-oriented compatibility aliases where implemented.
- **SDKs**: first-party TypeScript, Python, Go, and Ruby packages.
- **React email templates**: pass React components via the TypeScript SDK, or use registry-controlled dashboard starters with shared-renderer previews (see [docs/react-email-templates.md](docs/react-email-templates.md)).
- **Domain verification**: DKIM, SPF, DMARC, click tracking, and custom return paths, with Cloudflare automation.
- **Broadcasts**: block editor, slash commands, audience targeting, and review flow.
- **Automations**: multi-step workflows triggered by contact updates and custom events, executed by the ingester worker.
- **Audience**: contacts, segments, topics, custom properties, CSV import, and API routes.
- **Suppressions**: tenant-scoped bounce/complaint suppression handling.
- **Inbound email**: receive replies through `/api/emails/receiving`.
- **Webhooks**: HMAC-signed, Svix-compatible delivery for accepted/sent/delivered/opened/clicked/bounced/complained/delayed/failed events.
- **Hosted usage and billing**: plan-aware quotas, usage summaries, Stripe Checkout, and customer portal routes for OpenSend Cloud.
- **Dashboard**: dark-mode admin UI with the `/today` overview, live activity, domains, API keys, broadcasts, automations, templates, audience, metrics, logs, audit log, webhooks, billing, and settings.
- **Public status**: expose component health through `/status` and `/api/status`.
- **Health checks**: `/api/health`, ingester `/health`, and service readiness endpoints.

## Docs and LLM-ready reference

Open **http://localhost:3015/docs** for the first-party docs hub. The generated markdown corpus and machine-readable references live at:

- `/docs/llms.txt` — canonical LLM documentation index for OpenSend-owned docs.
- `/openapi.json` — route and schema source of truth for API integrations.
- `public/docs/**/*.md` — public markdown pages indexed by `bun run docs:generate`.
- [`public/docs/mcp-server.md`](public/docs/mcp-server.md) — MCP guidance for AI clients.

High-signal starting points:

- [`/docs/self-hosting`](https://opensend.namuh.co/docs/self-hosting) for local and production deployment.
- [`/docs/security`](https://opensend.namuh.co/docs/security) for API keys, tenant scoping, webhook signing, and vulnerability reporting.
- [`/docs/privacy`](https://opensend.namuh.co/docs/privacy) for the zero-phone-home self-hosting promise.
- [`/openapi.json`](https://opensend.namuh.co/openapi.json) for exact API schemas.
- [`packages/sdk/README.md`](./packages/sdk/README.md) for the TypeScript SDK.

When adding public API, SDK, dashboard, webhook, automation, or operations docs, update the matching `public/docs/**/*.md` page and run `bun run docs:generate`.

## API quickstart

### Send an email with HTTP

```bash
curl -X POST http://localhost:3015/api/emails \
  -H "Authorization: Bearer $OPENSEND_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "from": "hello@yourdomain.com",
    "to": ["recipient@example.com"],
    "subject": "Hello from OpenSend",
    "html": "<h1>It works!</h1>"
  }'
```

Open **http://localhost:3015/docs** for the local API reference.

### TypeScript SDK

```bash
bun add opensend
```

```ts
import { Opensend } from "opensend";

const client = new Opensend(process.env.OPENSEND_API_KEY!, {
  baseUrl: "https://your-deployment.example.com",
});

const { data } = await client.emails.send({
  from: "hello@yourdomain.com",
  to: "recipient@example.com",
  subject: "Hello from OpenSend",
  html: "<h1>It works!</h1>",
});

console.log("Queued email", data?.id);
```

Full docs: [`packages/sdk/README.md`](./packages/sdk/README.md)

### Python SDK

```bash
python -m pip install ./packages/python-sdk
```

```py
import os
import opensend

opensend.api_key = os.environ["OPENSEND_API_KEY"]
opensend.base_url = os.environ.get("OPENSEND_BASE_URL", opensend.DEFAULT_BASE_URL)

email = opensend.Emails.send({
    "from": "hello@yourdomain.com",
    "to": "recipient@example.com",
    "subject": "Hello from OpenSend",
    "html": "<h1>It works!</h1>",
})

print("Queued email", email["id"])
```

Full docs: [`packages/python-sdk/README.md`](./packages/python-sdk/README.md) and [`docs/sdk/python.md`](./docs/sdk/python.md)

### Go SDK

```bash
go get github.com/namuh-eng/opensend/packages/go-sdk@v0.1.0
```

```go
package main

import (
	"context"
	"fmt"
	"log"
	"os"

	opensend "github.com/namuh-eng/opensend/packages/go-sdk"
)

func main() {
	client, err := opensend.NewClient(os.Getenv("OPENSEND_API_KEY"))
	if err != nil {
		log.Fatal(err)
	}

	email, err := client.Send(context.Background(), opensend.SendRequest{
		From:    "hello@yourdomain.com",
		To:      []string{"recipient@example.com"},
		Subject: "Hello from OpenSend",
		HTML:    "<h1>It works!</h1>",
	})
	if err != nil {
		log.Fatal(err)
	}

	fmt.Println("Queued email", email.ID)
}
```

Full docs: [`packages/go-sdk/README.md`](./packages/go-sdk/README.md) and [`docs/sdk/go.md`](./docs/sdk/go.md)

### Ruby SDK

```bash
cd packages/ruby-sdk
gem build opensend.gemspec
gem install ./opensend-0.1.0.gem
# After the RubyGems publish is complete:
# gem install opensend
```

```ruby
require "opensend"

OpenSend.api_key ENV.fetch("OPENSEND_API_KEY")

email = OpenSend::Emails.send(
  from: "hello@yourdomain.com",
  to: "recipient@example.com",
  subject: "Hello from OpenSend",
  html: "<h1>It works!</h1>"
)

puts "Queued email #{email.fetch('id')}"
```

Full docs: [`packages/ruby-sdk/README.md`](./packages/ruby-sdk/README.md) and [`docs/sdk/ruby.md`](./docs/sdk/ruby.md)

## Self-hosting

### Requirements

- Docker and Docker Compose
- AWS account with SES access for real email delivery
- Optional Cloudflare account for automatic DNS records
- Optional Redis/SQS/EventBridge for production-grade rate limiting and background jobs

### Docker Compose

```bash
git clone https://github.com/namuh-eng/opensend.git
cd opensend
cp .env.example .env
# Set BETTER_AUTH_SECRET, Google OAuth if you want dashboard login,
# and AWS credentials when you want real sending.
docker compose up -d
```

The dashboard/API runs at **http://localhost:3015**. The ingester health endpoint is **http://localhost:3016/health**.

### Production deployments

Read the deployment guides before shipping real traffic:

- [`docs/self-hosting.md`](docs/self-hosting.md) — env vars, database, SES, DNS, auth, reverse proxy, background jobs, Redis, upgrades, troubleshooting.
- [`docs/ingester-deploy.md`](docs/ingester-deploy.md) — standalone ingester deployment, SNS cutover, replay runbook.
- [`docs/observability.md`](docs/observability.md) — logs, metrics, traces, and provider tracing.
- [`docs/hosted-stripe-cutover.md`](docs/hosted-stripe-cutover.md) — hosted Stripe/paywall cutover checklist.

Production gotchas worth not learning the hard way:

- Run migrations before app code that expects new columns.
- Build Linux images for Linux deploys: `docker buildx build --platform linux/amd64 ...`.
- Keep app and ingester as separate deployable services for production traffic.
- Point SES/SNS events at the ingester `/events/ses` endpoint, not the Next.js app.
- Inject secrets at runtime from a real secrets manager; do not bake them into images.

## Architecture

OpenSend is a Bun workspace monorepo. The Next.js app and production Hono ingester share a typed core package. Experimental service skeletons live alongside the current production path so migrations can happen incrementally.

```text
src/                 # Next.js app and public API routes
├── app/             # App Router pages, dashboard, auth, docs, API
├── components/      # React UI
├── lib/             # auth, db, SES, S3, Cloudflare, cache, workers, events
└── middleware.ts    # API rate limiting

packages/
├── core/            # Shared DB client, repositories, DTOs, webhook helpers
├── ingester/        # Production Hono ingester and workers, port 3016
├── sdk/             # TypeScript SDK
├── python-sdk/      # Python SDK
├── go-sdk/          # Go SDK
└── ruby-sdk/        # Ruby SDK

services/
├── api/             # Bun + Hono control-plane API skeleton, port 3026
└── opensend-cli/    # Go CLI (opensend) — api-keys, logs, send, doctor, domains, health

tests/               # Vitest unit tests
tests/e2e/           # Playwright E2E tests
drizzle/             # Generated migration SQL
docs/                # Deployment, SDK, and operations docs
```

## Tech stack

| Layer                    | Technology                                      |
| ------------------------ | ----------------------------------------------- |
| Framework                | Next.js 16, App Router, Turbopack               |
| Runtime/package manager  | Bun                                             |
| Language                 | TypeScript strict mode                          |
| UI                       | Tailwind CSS, Radix UI, React 19                |
| Auth                     | Better Auth with Google OAuth and organizations |
| Database                 | PostgreSQL, Drizzle ORM                         |
| Email                    | AWS SES v2                                      |
| Storage                  | AWS S3                                          |
| DNS                      | Cloudflare API                                  |
| Billing for hosted cloud | Stripe                                          |
| Ingester                 | Hono on Bun                                     |
| Background jobs          | AWS SQS, EventBridge, scheduler sidecar         |
| Cache/rate limit         | Redis                                           |
| Tests                    | Vitest, Playwright                              |
| Lint/format              | Biome                                           |

## Development commands

```bash
make setup       # first-time local setup
make dev         # app on http://localhost:3015
make check       # full typecheck + lint
make test        # Vitest
make test-e2e    # Playwright, requires dev server
make all         # check + test
make fix         # Biome autofix
bun run docs:generate # rebuild public/docs/llms.txt after public docs changes
```

Useful package commands:

```bash
bun run dev:api              # control-plane API skeleton on :3026
bun run start:ingester       # production ingester locally on :3016
make cli-check               # Go CLI vet + tests
cd packages/go-sdk && go test ./...
ruby -I packages/ruby-sdk/lib packages/ruby-sdk/test/opensend_test.rb
```

## Agent setup

This repo is designed to be understandable to coding agents, but agent setup is contributor workflow, not the product quickstart. Start with [`AGENTS.md`](./AGENTS.md) and [`CONTRIBUTING.md`](./CONTRIBUTING.md), branch from `staging`, use the existing Next.js/Playwright/Biome/Drizzle/Docker setup, and run the narrowest useful check while iterating before the full validation bar.

## Roadmap

- [x] Webhook signature verification with Svix-compatible HMAC headers
- [x] Email scheduling with EventBridge/SQS-backed scans
- [x] Team support with multi-tenant auth and organization invites
- [x] Built-in open/click analytics
- [x] Additional webhook event types: opened, clicked, complained, delivery delayed
- [x] Familiar audiences/contact API slices
- [ ] SMTP relay support without AWS SES

## Contributing

Contributions are welcome. Read [`CONTRIBUTING.md`](./CONTRIBUTING.md), branch from `staging`, keep changes narrow, and include validation evidence in the PR.

## License

[Elastic License 2.0](./LICENSE) - free to use, modify, and self-host. The restriction: you cannot offer OpenSend itself as a hosted email service to third parties.

---

<p align="center">
  Built by <a href="https://github.com/jaeyunha">Jaeyun Ha</a> and <a href="https://github.com/ashley-ha">Ashley Ha</a>
</p>
