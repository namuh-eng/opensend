# Self-hosting OpenSend

OpenSend is built to run on your own infrastructure. This guide walks through
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
- [Hosted Stripe billing](#hosted-stripe-billing)
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
# Edit .env for production secrets, Google OAuth, SES, S3, and DNS.
docker compose up -d
```

This launches:

- `postgres` (5432) — local Postgres, persisted in a named volume
- `migrate` — runs Drizzle migrations once and exits
- `app` (3015 → 8080 in container) — dashboard + REST API
- `ingester` (3016) — SES/SNS event handler and background worker
- `scheduler` — durable sidecar that triggers ingester `/jobs/*` scans

Open `http://localhost:3015`. The first sign-in creates an organization and
makes you the owner.

`.env.example` includes local-only placeholders for `BETTER_AUTH_SECRET`,
`INGESTER_JOB_TOKEN`, and `WEBHOOK_SECRET_ENCRYPTION_KEY` so the Compose stack
can boot immediately for localhost evaluation. Replace them before any shared,
staging, or production deployment:

```bash
openssl rand -hex 32
```

To wipe the database volume and start clean: `docker compose down -v`.

## Environment variables

All configuration is via environment variables. `.env.example` ships with the
contributor-facing set; the table below adds the production-only entries.

### Required

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection string. In Docker Compose the app/migrator containers override this to use the internal `postgres` host. |
| `BETTER_AUTH_SECRET` | Random 32-byte hex string for session signing. Generate with `openssl rand -hex 32`. The checked-in local placeholder is allowed only for localhost evaluation; app and ingester startup checks reject it when the configured app URL is not localhost. |
| `WEBHOOK_SECRET_ENCRYPTION_KEY` | Random secret, at least 16 characters, used to encrypt webhook signing secrets at rest. Docker Compose passes this into both the app and ingester. The checked-in value is local-only; production app and ingester startup fail when this is missing or too short. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Better Auth Google OAuth credentials. Set the redirect URI to `https://<your-host>/api/auth/callback/google`. |

### Required for sending email

| Variable | Purpose |
| --- | --- |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | IAM credentials with SES + (optionally) S3, SQS, EventBridge permissions. Prefer IAM roles when available. |
| `AWS_REGION` | Default AWS region for non-domain-scoped AWS clients such as SQS/S3. SES sends and domain identity calls use the selected domain's region and fall back to `us-east-1` when no domain row is available. |

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
| `INGESTER_JOB_TOKEN` | Required 32+ character bearer token for `/jobs/*` endpoints when the scheduler/EventBridge invokes them over HTTP. Docker Compose refuses to start the ingester/scheduler without it. |
| `INGESTER_INBOUND_TOKEN` | Optional for local development. In production, `/events/inbound` rejects requests unless this bearer token is configured and sent by the inbound provider. |
| `SES_INBOUND_SNS_TOPIC_ARN` | SNS topic for SES receipt-rule S3 notifications. Required for hosted-style receiving provisioning. Subscribe it to `/events/inbound/ses-s3`. |
| `SES_INBOUND_BUCKET_NAME` | Optional raw MIME bucket allowlist for SES receipt-rule ingestion. Defaults to `S3_BUCKET_NAME`. |
| `SES_INBOUND_RULE_SET_NAME` | Optional SES receipt rule set managed by the dashboard receiving toggle. Defaults to `opensend-inbound`. |
| `INGESTER_SCHEDULER_INTERVAL_SECONDS` | Compose scheduler cadence for `/jobs/scheduled-emails`, `/jobs/webhooks`, `/jobs/domain-verify`, and `/jobs/billing-overage`. Default `60`; minimum `10`. |
| `RATE_LIMIT_BACKEND` | `disabled` (single-process dev), or `redis` (production). |
| `REDIS_URL` | TLS Redis endpoint, e.g. `rediss://default:<password>@<endpoint>:6379`. Used for rate limiting AND auth/domain metadata cache. |
| `CLOUDWATCH_METRICS_NAMESPACE` | Override the default `OpenSend` EMF metrics namespace. |

### AWS ECS deploy secret wiring

The repo deploy script registers a fresh app task definition before updating
the ECS app service. It injects `WEBHOOK_SECRET_ENCRYPTION_KEY` from AWS
Secrets Manager and never reads or prints the secret value. By default it looks
up the secret named `opensend/webhook/secret-encryption-key` when
`PRODUCT=opensend`; override that lookup with
`WEBHOOK_SECRET_ENCRYPTION_KEY_SECRET_ID` or pass an exact
`WEBHOOK_SECRET_ENCRYPTION_KEY_SECRET_ARN` when your bootstrap uses a different
name.

### Hosted Stripe billing

Billing is disabled by default for self-host/local OSS deploys. Leave
`BILLING_BACKEND` unset or set it to `disabled` to keep sends unmetered by
OpenSend plan quotas. The hosted namuh.co deployment sets billing env from its
secret manager instead of committing secrets.

| Variable | Service | Purpose |
| --- | --- | --- |
| `BILLING_BACKEND=stripe` | App + ingester | Enables hosted Stripe/paywall behavior. Any other value is treated as disabled. |
| `STRIPE_SECRET_KEY` | App + ingester | Stripe API key for hosted billing. Required before the app exposes Checkout/Portal behavior. |
| `STRIPE_WEBHOOK_SECRET` | Ingester | Signing secret for the Stripe webhook endpoint at `/webhooks/stripe`. |
| `BILLING_NOTIFICATION_FROM_EMAIL` | Ingester, optional | Sender used for payment-failed notifications. |
| `STRIPE_OVERAGE_METER_EVENT_NAME` | Ingester, optional | Stripe meter event name for paid-plan overage reporting. Defaults to `opensend_email_overage`; ignored when billing is disabled. |

Before enabling hosted billing, read the full cutover checklist in
[`hosted-stripe-cutover.md`](hosted-stripe-cutover.md) and run:

```bash
bun run billing:preflight -- --service all --check-db --strict
```

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

### Region-aware sending

OpenSend Phase 1 uses **domain-selected SES regions**, not transparent
same-domain failover. Each sending domain has one configured SES region, and
the background worker routes a queued send to the SES region for the `From`
domain owned by that OpenSend user. If the sender has no matching domain row,
delivery falls back to `us-east-1`.

Supported dashboard/API domain regions:

- `us-east-1`
- `eu-west-1`
- `sa-east-1`
- `ap-northeast-1`

Before selecting a non-default region for a domain, set up that SES region
independently:

1. Request SES production access or understand sandbox limitations for that
   region.
2. Confirm the region's sending quotas and rate limits are sufficient.
3. Create/verify the domain identity and DKIM records in that same region
   through OpenSend.
4. Publish the MAIL FROM MX value rendered by OpenSend:
   `feedback-smtp.<region>.amazonses.com`.
5. Configure SNS/configuration-set feedback topics for each sending region and
   point them at the ingester `/events/ses` endpoint.

Backup-domain failover and SES Global Endpoints are not implemented in this
phase; model regional resilience as separate domains until that Phase 2 work
lands.

### Sandbox vs production

New AWS accounts start in **SES sandbox mode** — emails only go to verified
addresses. Sandbox/production status is region-scoped. To send to anyone,
request production access from the SES console in every sending region:
**Account dashboard → Request production access**.

### IAM minimum

The IAM principal OpenSend uses needs:

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

Three periodic scans need to run every minute:

- **Scheduled emails**: enqueue due `email.send` jobs.
- **Webhook retry**: re-attempt failed webhook deliveries whose
  `next_retry_at` has arrived.
- **Domain verification**: reconcile SES-verified domains and flip OpenSend
  domain/record status to `verified` without clicking **Verify DNS Records**.

Docker Compose runs the durable `scheduler` sidecar by default. It posts to all four ingester job endpoints every `INGESTER_SCHEDULER_INTERVAL_SECONDS` seconds and includes `Authorization: Bearer ${INGESTER_JOB_TOKEN}`. `.env.example` includes a local-only placeholder; replace it with a generated 32+ character value before any shared, staging, or production deploy.

Two other production patterns can drive the same endpoints:

**Option 1: EventBridge → HTTP**. Schedule rules that POST to the ingester
with the `INGESTER_JOB_TOKEN` bearer:

```bash
INGESTER_URL="https://events.yourdomain.com"
curl -i -X POST "${INGESTER_URL}/jobs/scheduled-emails" \
  -H "Authorization: Bearer ${INGESTER_JOB_TOKEN}"
curl -i -X POST "${INGESTER_URL}/jobs/webhooks" \
  -H "Authorization: Bearer ${INGESTER_JOB_TOKEN}"
curl -i -X POST "${INGESTER_URL}/jobs/domain-verify" \
  -H "Authorization: Bearer ${INGESTER_JOB_TOKEN}"
curl -i -X POST "${INGESTER_URL}/jobs/billing-overage" \
  -H "Authorization: Bearer ${INGESTER_JOB_TOKEN}"
```

**Option 2: SQS scan jobs**. Publish `scheduled-email.scan` and
`webhook-delivery.scan` messages on a schedule. Domain verification and billing overage reporting are HTTP-only today, so keep an HTTP schedule for `/jobs/domain-verify` and `/jobs/billing-overage` even if scheduled emails and webhook retries are queue-driven.


### Domain verification scheduler runbook

To verify the automatic domain reconciler in a deployment:

1. Create a new domain from the dashboard/API, or use an existing domain whose OpenSend status is `not_started` or `pending`.
2. Publish the DKIM/SPF/DMARC records and confirm AWS SES reports the identity as verified (`VerifiedForSendingStatus=true` and DKIM `SUCCESS`).
3. Do **not** click **Verify DNS Records** in OpenSend.
4. Wait one scheduler interval plus SES/API latency (normally 1-2 minutes with the default 60-second cadence).
5. Confirm the OpenSend dashboard or database now shows the domain status and DNS record badges as `verified`.
6. If it does not flip, inspect the scheduler and ingester logs for `/jobs/domain-verify` responses and verify the scheduler and ingester share the same `INGESTER_JOB_TOKEN`.

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
