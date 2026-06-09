# Self Hosting

Run OpenSend on infrastructure you control with Docker Compose, PostgreSQL, AWS SES/S3, and the standalone ingester service.

Self-hosted OpenSend uses your AWS SES quota, your database, your secrets, and your observability stack. The reference Compose stack is meant to be truthful for evaluation, while production deployments should split the app, ingester, scheduler, database, queue, cache, and secrets into managed runtime services.

## Reference topology

Docker Compose starts the same service boundaries used by production deployments:

- `app`: Next.js dashboard and public API on port `3015`.
- `postgres`: OpenSend application database.
- `migrate`: one-shot Drizzle migration runner.
- `ingester`: SES/SNS event receiver and background worker on port `3016`.
- `scheduler`: sidecar that triggers ingester `/jobs/*` scans.

Production deployments can run these as separate services on ECS, Fly, Railway, Cloud Run, Kubernetes, or a single VM. Keep app traffic pointed at the Next.js service, and point SES/SNS event webhooks at the ingester.

## Quick start

```bash
git clone https://github.com/namuh-eng/opensend.git
cd opensend
cp .env.example .env
docker compose up -d
```

Open `http://localhost:3015`.

`.env.example` includes local-only placeholders for `BETTER_AUTH_SECRET`, `INGESTER_JOB_TOKEN`, and `WEBHOOK_SECRET_ENCRYPTION_KEY` so the stack can boot for localhost evaluation. Replace them before any shared, staging, or production deployment:

```bash
openssl rand -hex 32
```

For real email delivery, add AWS SES credentials and verify a sending domain. For dashboard login, add Google OAuth credentials.

The app and ingester reject the checked-in `BETTER_AUTH_SECRET` placeholder when `BETTER_AUTH_URL` or `NEXT_PUBLIC_APP_URL` points somewhere other than localhost.

## Configuration model

All runtime configuration comes from environment variables. Local Compose reads `.env`; production should inject secrets at runtime from a secrets manager such as AWS Secrets Manager, Doppler, Vault, or the secret store for your platform.

Minimum local evaluation values:

```env
DATABASE_URL=postgresql://opensend:opensend@localhost:5432/opensend
POSTGRES_PASSWORD=opensend
BETTER_AUTH_URL=http://localhost:3015
NEXT_PUBLIC_APP_URL=http://localhost:3015
BETTER_AUTH_SECRET=local-dev-better-auth-secret-replace-before-production
INGESTER_JOB_TOKEN=local-dev-ingester-job-token-replace-before-production
WEBHOOK_SECRET_ENCRYPTION_KEY=local-dev-webhook-secret-replace-before-production
```

Production values to plan before real traffic:

| Category | Variables |
| --- | --- |
| Database | `DATABASE_URL`, `POSTGRES_PASSWORD` for Compose-only Postgres |
| Auth | `BETTER_AUTH_URL`, `NEXT_PUBLIC_APP_URL`, `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `BETTER_AUTH_TRUSTED_ORIGINS` |
| Email | `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` or equivalent IAM role credentials |
| Attachments | `S3_BUCKET_NAME` |
| Domain DNS | `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ZONE_ID` when using automatic DNS setup |
| Background jobs | `BACKGROUND_JOBS_QUEUE_URL`, `BACKGROUND_JOBS_REQUIRE_QUEUE=true`, `BACKGROUND_WORKER_POLL=true` on the ingester |
| Scheduler auth | `INGESTER_JOB_TOKEN`, `INGESTER_SCHEDULER_INTERVAL_SECONDS` |
| Inbound auth | `INGESTER_INBOUND_TOKEN` when `/events/inbound` is exposed |
| Rate limiting/cache | `RATE_LIMIT_BACKEND=redis`, `REDIS_URL` |
| Secret encryption | `WEBHOOK_SECRET_ENCRYPTION_KEY`, optional `INTEGRATION_SECRET_ENCRYPTION_KEY`, optional DKIM encryption key variables |
| Observability | Sentry, PostHog, CloudWatch, or OTel variables you explicitly configure |

## Database and migrations

Migrations are committed Drizzle SQL files. Run them before deploying app code that expects new tables or columns:

```bash
bun run db:migrate
```

Docker Compose runs the `migrate` service before the app and ingester start. If your platform does not run the migrator automatically, make it a release step. A detail page that 404s while list pages still work is often a swallowed schema mismatch, not a missing route.

## SES and event ingestion

OpenSend sends through AWS SES v2. The app accepts and queues email work; the ingester handles background delivery, SES/SNS feedback events, scheduled sends, webhook retries, and domain verification scans.

Point SES SNS notifications at the ingester:

```txt
https://YOUR_INGESTER_HOST/events/ses
```

Do not point SES/SNS events at the Next.js app URL. Keep the ingester reachable from AWS, and keep its `/jobs/*` endpoints protected by `INGESTER_JOB_TOKEN`.

## Background jobs

For production sends, configure the queue-backed path:

1. Create an SQS queue and dead-letter queue.
2. Set `BACKGROUND_JOBS_QUEUE_URL` on the app and ingester.
3. Set `BACKGROUND_JOBS_REQUIRE_QUEUE=true` on the app so missing queue wiring fails loudly.
4. Set `BACKGROUND_WORKER_POLL=true` on the ingester.
5. Keep the scheduler, EventBridge, or an equivalent trusted caller posting to `/jobs/scheduled-emails`, `/jobs/webhooks`, and `/jobs/domain-verify` with `Authorization: Bearer ${INGESTER_JOB_TOKEN}`.

Local evaluation can run without SQS; rows are still persisted, but production delivery needs the worker path.

## Rate limiting and cache

Single-process local evaluation can use the default memory behavior. Shared or production deployments should use Redis:

```env
RATE_LIMIT_BACKEND=redis
REDIS_URL=rediss://default:<password>@your-cache-endpoint:6379
```

Redis backs API rate limiting plus hot-path auth and domain metadata caches. Use a TLS endpoint and keep it private to your runtime network.

## Privacy and telemetry

Self-hosted OpenSend makes zero outbound calls to OpenSend-operated vendors unless you configure the related environment variables. See [Privacy](/docs/privacy) for the full promise and the hosted-cloud boundary.

## Validation checklist

Before sending real production traffic:

1. Run migrations against the target database.
2. Confirm `GET /api/health` returns healthy.
3. Confirm the ingester `/health` endpoint returns healthy.
4. Send a real SES-backed email and confirm provider success.
5. Confirm SES/SNS events reach `/events/ses`.
6. Confirm scheduled jobs run with the same `INGESTER_JOB_TOKEN` configured on the scheduler and ingester.
7. Confirm rate limiting, queue, integration encryption, and secret-manager variables are set for shared deployments.

Useful local checks:

```bash
docker compose --env-file .env.example config
make check
make test
bun run build
```

## Troubleshooting

### Compose fails before starting

Run `docker compose --env-file .env.example config`. Missing interpolation errors usually mean a required env var was removed from `.env`.

### Emails stay queued

Check `BACKGROUND_JOBS_QUEUE_URL`, `BACKGROUND_WORKER_POLL`, SQS IAM permissions, and ingester logs. In local evaluation without a queue, persisted rows are expected; production delivery needs the worker path.

### Domain verification does not update

Check that the scheduler is posting to `/jobs/domain-verify`, that the scheduler and ingester share the same `INGESTER_JOB_TOKEN`, and that SES reports the domain identity as verified in the selected region.

### Public docs or API docs look stale

Run `bun run docs:generate` after changing `public/docs/**/*.md`, and keep `/docs`, `/docs/llms.txt`, and `/openapi.json` reachable from the deployment.
