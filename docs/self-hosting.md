# Self-hosting Opensend

Opensend is built to run on your own infrastructure. This guide walks through
the practical deployment paths from a single-machine Docker Compose setup to a
production-ready, multi-process deployment with managed Postgres, SES, Redis,
and SQS-backed background workers.

If you just want to try it locally, the README quickstart is enough — start
there. This document is for production deployments.

## Contents

- [Deployment options](#deployment-options)
- [Requirements](#requirements)
- [Quickstart: Docker Compose](#quickstart-docker-compose)
- [Environment variables](#environment-variables)
- [Database](#database)
- [AWS SES](#aws-ses)
- [Domain verification & DNS](#domain-verification--dns)
- [Email attachments (S3)](#email-attachments-s3)
- [Auth](#auth)
- [Reverse proxy & TLS](#reverse-proxy--tls)
- [Background jobs (SQS + EventBridge)](#background-jobs-sqs--eventbridge)
- [Shared rate limiting (Redis)](#shared-rate-limiting-redis)
- [Splitting the ingester service](#splitting-the-ingester-service)
- [Observability](#observability)
- [Upgrades & migrations](#upgrades--migrations)
- [Troubleshooting](#troubleshooting)

## Deployment options

| Option | Best for | Tradeoffs |
| --- | --- | --- |
| **Docker Compose, single host** | Trial deploys, small workloads, internal tools | App, ingester, and Postgres on one box. No HA. |
| **Single VM + managed Postgres** | Small production, predictable cost | One container per service, managed DB, external Redis/SQS optional |
| **Container platform** (AWS ECS, Google Cloud Run, Fly.io, Railway) | Production at scale | Multi-replica, autoscaling, requires managed Postgres + Redis + SQS |
| **Kubernetes** | Large teams already on k8s | Most flexibility, most operational surface area |

The Dockerfile in this repo is multi-stage and builds three artifacts:

- `app` — Next.js dashboard + REST API (default target)
- `migrator` — runs `src/lib/db/migrate.ts` once and exits
- The standalone ingester is built from `packages/ingester/Dockerfile`

You can run all three on the same machine via Docker Compose, or split them
across separate services on a container platform.

## Requirements

| Component | Minimum | Recommended for production |
| --- | --- | --- |
| Docker | 24+ with buildx | 24+ |
| PostgreSQL | 14 | 15+ managed (RDS, Supabase, Neon, Cloud SQL) |
| Node/Bun | Bun 1.1+ | Bun 1.1+ (only needed if running outside Docker) |
| AWS account | SES + IAM | SES + S3 + SQS + EventBridge + Secrets Manager |
| DNS provider | Any (manual records) | Cloudflare (auto-configures DKIM/SPF/DMARC) |
| Redis | none for dev | Managed Redis 6+ with TLS (ElastiCache, Upstash) |

AWS credentials are **optional for local dev** — without them, send calls log
to the console and the rest of the API still works.

## Quickstart: Docker Compose

```bash
git clone https://github.com/namuh-eng/opensend.git
cd opensend
cp .env.example .env
# Edit .env — see "Environment variables" below
docker compose up -d
```

This launches:

- `postgres` (5432) — local Postgres, persisted in a named volume
- `migrate` — runs Drizzle migrations once and exits
- `app` (3015 → 8080 in container) — dashboard + REST API
- `ingester` (3016) — SES/SNS event handler and background worker

Open `http://localhost:3015`. The first sign-in creates an organization and
makes you the owner.

To wipe the database volume and start clean: `docker compose down -v`.

## Environment variables

All configuration is via environment variables. `.env.example` ships with the
contributor-facing set; the table below adds the production-only entries.

### Required

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection string. In Docker Compose the app/migrator containers override this to use the internal `postgres` host. |
| `BETTER_AUTH_SECRET` | Random 32-byte hex string for session signing. Generate with `openssl rand -hex 32`. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Better Auth Google OAuth credentials. Set the redirect URI to `https://<your-host>/api/auth/callback/google`. |

### Required for sending email

| Variable | Purpose |
| --- | --- |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | IAM credentials with SES + (optionally) S3, SQS, EventBridge permissions. Prefer IAM roles when available. |
| `AWS_REGION` | SES region. Use `us-east-1` unless you have a reason to pick another. |

### Optional

| Variable | Purpose |
| --- | --- |
| `PORT` | Dashboard/API port. Default `3015`. |
| `INGESTER_PORT` | Ingester port. Default `3016`. |
| `POSTGRES_PORT` | Compose-only Postgres host port. Default `5432`. Change this AND `DATABASE_URL` if 5432 is taken. |
| `S3_BUCKET_NAME` | Email attachment storage. Without this, attachments are rejected. |
| `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ZONE_ID` | If set, the dashboard auto-writes DKIM/SPF/DMARC records when a domain is added. |
| `SKIP_STAR_PROMPT=1` | Suppresses the optional GitHub star prompt during `bun install`. |

### Production-only (background jobs, cache, rate limiting)

| Variable | Purpose |
| --- | --- |
| `BACKGROUND_JOBS_QUEUE_URL` | SQS queue URL used for `email.send`, `webhook.dispatch`, scheduled-email scan, and webhook retry scan jobs. |
| `BACKGROUND_JOBS_REQUIRE_QUEUE=true` | Fail API publish when the queue URL is missing instead of silently skipping. Required in production. |
| `BACKGROUND_JOBS_EVENT_BUS_NAME` | Optional EventBridge bus for job lifecycle events. |
| `BACKGROUND_WORKER_POLL=true` | Set on the **ingester** service only. Enables long-poll SQS consumer. |
| `INGESTER_JOB_TOKEN` | Bearer token required for `/jobs/*` endpoints when EventBridge invokes them over HTTP. |
| `RATE_LIMIT_BACKEND` | `disabled` (single-process dev), or `redis` (production). |
| `REDIS_URL` | TLS Redis endpoint, e.g. `rediss://default:<password>@<endpoint>:6379`. Used for rate limiting AND auth/domain metadata cache. |
| `CLOUDWATCH_METRICS_NAMESPACE` | Override the default `Opensend` EMF metrics namespace. |

## Database

### Local

`docker compose up postgres` is enough for development. The data lives in a
named volume; `docker compose down -v` wipes it.

### Managed Postgres (recommended for production)

Any Postgres 14+ instance works: AWS RDS, Supabase, Neon, Cloud SQL, etc. Set
`DATABASE_URL` to its connection string. If your provider requires SSL, the
client opts in via `?sslmode=require` in the URL.

### Migrations

Migrations are committed Drizzle SQL files in `drizzle/`. The Dockerfile has a
`migrator` target that runs `src/lib/db/migrate.ts` once and exits.

```bash
# Apply migrations to the configured DATABASE_URL
bun run db:migrate

# Or run the migrator container
docker run --rm --env-file .env $(docker build -q --target migrator .)
```

**Always run migrations before deploying app code that expects new columns.**
A list page that works while a detail page 404s after a deploy is usually a
swallowed schema error, not a missing route.

### Schema push (dev only)

`bun run db:push` writes the current schema directly without going through
migrations. Use it for local iteration; never for production.

## AWS SES

### Sandbox vs production

New AWS accounts start in **SES sandbox mode** — emails only go to verified
addresses. To send to anyone, request production access from the SES console:
**Account dashboard → Request production access**.

### IAM minimum

The IAM principal Opensend uses needs:

- `ses:SendEmail`, `ses:SendRawEmail`
- `ses:GetAccount`, `ses:GetIdentity*`, `ses:VerifyDomainIdentity`,
  `ses:VerifyDomainDkim`, `ses:SetIdentityMailFromDomain`
- `ses:CreateConfigurationSet*`, `ses:PutConfigurationSet*` (used for
  click/open tracking domains and event publishing)

If you also use S3 for attachments and SQS for background jobs, grant
`s3:GetObject`/`PutObject` on the bucket prefix and the relevant SQS
`SendMessage` (app) / `ReceiveMessage`/`DeleteMessage`/`ChangeMessageVisibility`
(ingester) actions.

### SNS for delivery events

Email delivery, bounce, complaint, open, and click events come back via SNS.
Configure an SES configuration set with an SNS topic, then point the topic at
the ingester's `/events/ses` endpoint:

- Local: `http://localhost:3016/events/ses`
- Production: `https://<your-ingester-host>/events/ses`

The ingester verifies the SNS signature, so direct HTTP delivery from SNS is
sufficient — no shared secret needed.

## Domain verification & DNS

Adding a domain in the dashboard generates DKIM, SPF, DMARC, MAIL FROM, and
optional click-tracking records.

- **Cloudflare**: set `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ZONE_ID` and the
  records are written automatically when you click "Auto-configure".
- **Other DNS providers**: copy the rendered records from the dashboard into
  your DNS provider manually. The dashboard polls SES until verification
  passes.

For a production setup we recommend a dedicated subdomain like
`mail.yourdomain.com` so DMARC alignment doesn't conflict with your apex
domain's existing SPF policy.

## Email attachments (S3)

Attachments larger than ~5 KB are stored in S3 instead of Postgres. Set
`S3_BUCKET_NAME` to a bucket your IAM principal can read and write to.
Lifecycle rules to expire objects after 30–90 days are recommended.

## Auth

Better Auth handles sessions, organizations, and Google OAuth.

1. Create a Google Cloud project, enable the OAuth Consent Screen, and create
   an OAuth Client ID for "Web application".
2. Add `https://<your-host>/api/auth/callback/google` (and the localhost
   variant for dev) to **Authorized redirect URIs**.
3. Copy the client ID and secret into `GOOGLE_CLIENT_ID` /
   `GOOGLE_CLIENT_SECRET`.

Sessions are signed with `BETTER_AUTH_SECRET`. Rotate this only when you're
prepared to log every user out — there's no key rollover yet.

## Reverse proxy & TLS

The container listens on plain HTTP. Put a reverse proxy in front of it for
TLS termination.

### Caddy (simplest)

```caddy
yourdomain.com {
  reverse_proxy localhost:3015
}

events.yourdomain.com {
  reverse_proxy localhost:3016
}
```

### Nginx

```nginx
server {
  server_name yourdomain.com;
  listen 443 ssl http2;
  ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

  location / {
    proxy_pass http://127.0.0.1:3015;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

Mirror the block for `events.yourdomain.com → 127.0.0.1:3016` if you've split
out the ingester service.

## Background jobs (SQS + EventBridge)

Email sending is queue-first: `POST /api/emails` validates and persists the
email row as `queued`, then publishes an `email.send` job. The ingester
consumes the queue and calls SES.

This means **you need SQS in production**. Without it, sends never leave
`queued`.

### Required setup

1. Create an SQS queue (standard queue is fine; FIFO is supported if the URL
   ends in `.fifo`).
2. Configure a redrive policy with a DLQ. Worker failures leave messages
   undeleted so SQS retry/redrive owns retry exhaustion.
3. Set `BACKGROUND_JOBS_QUEUE_URL` on **both** the app and ingester services.
4. Set `BACKGROUND_WORKER_POLL=true` on the **ingester only**.
5. Set `BACKGROUND_JOBS_REQUIRE_QUEUE=true` on the app to fail loudly when the
   queue is misconfigured instead of silently dropping publishes.

### Scheduled jobs

Two periodic scans need to run every minute:

- **Scheduled emails**: enqueue due `email.send` jobs.
- **Webhook retry**: re-attempt failed webhook deliveries whose
  `next_retry_at` has arrived.

Two ways to drive them:

**Option 1: EventBridge → HTTP**. Schedule rules that POST to the ingester
with the `INGESTER_JOB_TOKEN` bearer:

```bash
INGESTER_URL="https://events.yourdomain.com"
curl -i -X POST "${INGESTER_URL}/jobs/scheduled-emails" \
  -H "Authorization: Bearer ${INGESTER_JOB_TOKEN}"
curl -i -X POST "${INGESTER_URL}/jobs/webhooks" \
  -H "Authorization: Bearer ${INGESTER_JOB_TOKEN}"
```

**Option 2: SQS scan jobs**. Publish `scheduled-email.scan` and
`webhook-delivery.scan` messages on a schedule. The ingester picks them up via
the same long-poll loop.

### Local dev fallback

If `BACKGROUND_JOBS_QUEUE_URL` is unset, sends and webhook dispatches log a
"queue not configured" warning and skip publish. Rows are still persisted, so
the dashboard works for development.

## Shared rate limiting (Redis)

API rate limiting is enforced by `src/middleware.ts`. There are two backends:

- `RATE_LIMIT_BACKEND=disabled` — skip rate limiting entirely. Default. Safe
  for single-process local dev only.
- `RATE_LIMIT_BACKEND=redis` — use a shared Redis token bucket. Required for
  any deployment with more than one app instance.

When `redis` is selected, `REDIS_URL` must point at a TLS endpoint
(`rediss://...`). If Redis is unreachable, requests fail closed with HTTP 503
rather than silently falling back to per-process memory.

The same Redis is reused for hot-path metadata caching:

- API key auth lookups by token hash (5 min TTL)
- Domain DB detail lookups by id (5 min TTL)
- SES domain identity lookups by domain name (2 min TTL)

Cache invalidation is automatic on create/update/delete/verify flows.

## Splitting the ingester service

In Docker Compose the app and ingester run side by side. In production they
should be **separate processes** so a webhook burst or worker stall doesn't
stall the dashboard.

Build them from the same repo:

```bash
docker buildx build --platform linux/amd64 \
  -t yourorg/opensend-app:latest --push .

docker buildx build --platform linux/amd64 \
  -f packages/ingester/Dockerfile \
  -t yourorg/opensend-ingester:latest --push .
```

Run them as separate services on whatever platform you use (ECS, Cloud Run,
Fly Machines, Kubernetes deployments). Both connect to the same Postgres,
Redis, and SQS.

For the ALB/Cloud-Run/Fly host-based routing details, SES SNS cutover, and
ingester replay, see [`ingester-deploy.md`](ingester-deploy.md).

## Observability

The app and ingester emit:

- **Structured JSON logs** with `x-correlation-id` and W3C-compatible
  `traceparent` headers. PII (recipient addresses, subjects) is redacted by
  default.
- **CloudWatch EMF metrics** for accept latency, send outcomes, queue depth,
  worker retries, and SES ingest results. Set `CLOUDWATCH_METRICS_NAMESPACE`
  to override the namespace.

See [`observability.md`](observability.md) for the metric catalog, alarm
recommendations, and the API-to-provider tracing runbook.

A simple `/api/health` endpoint is exposed for uptime probes; the ingester has
`/health` on the same shape.

## Upgrades & migrations

1. Pull the new code (`git pull`) or update your image tag.
2. Run `bun run db:migrate` (or the migrator container) **before** rolling out
   the new app/ingester image.
3. Roll the app and ingester forward.

Compose users get this automatically — the `migrate` service runs on every
`docker compose up` before `app` starts.

If your deploy path doesn't run migrations automatically, schema-drifted dashboards
typically present as detail-page 404s while list pages work. Re-run the
migrator and inspect logs before assuming missing routes.

## Troubleshooting

### Sign-in redirects loop

The OAuth redirect URI registered with Google must exactly match
`https://<host>/api/auth/callback/google`. Check the host casing and the
trailing slash.

### Emails stuck in `queued`

Either `BACKGROUND_JOBS_QUEUE_URL` isn't set, the ingester isn't running with
`BACKGROUND_WORKER_POLL=true`, or the IAM principal is missing
`sqs:ReceiveMessage`/`DeleteMessage`. Tail the ingester logs.

### `bun install` fails inside a Docker build

Use `--ignore-scripts` at the `deps` stage. The repo's postinstall calls
`node scripts/install-git-hooks.mjs`, which isn't present in the minimal deps
layer.

### `redis` import in middleware crashes

Next.js middleware runs on the Edge runtime by default, which can't import the
`redis` npm package (it pulls in `node:crypto`). The repo opts in to the Node
runtime via `experimental.nodeMiddleware` in `next.config.js` and
`runtime: "nodejs"` on the middleware export. Don't remove these.

### M-chip Mac builds fail in production

Always pass `--platform linux/amd64` to `docker buildx build` and make sure
you `--push` (not `--load`) so a multi-arch manifest doesn't fall back to your
local arm64 layer.

### Detail page 404s after a deploy

Schema drift. The detail server component caught a missing-column error and
called `notFound()`. Run migrations before redeploying app code that expects
new columns.
