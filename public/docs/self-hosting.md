# Self Hosting

Run OpenSend on your own infrastructure with Docker Compose, PostgreSQL, AWS SES/S3, and the standalone ingester service.

## Reference topology

Docker Compose is the reference deployment path for self-hosters:

- `app` — Next.js dashboard and public API on port `3015`.
- `postgres` — OpenSend application database.
- `migrate` — one-shot Drizzle migration runner.
- `ingester` — SES/SNS event receiver and scheduled worker on port `3016`.
- `scheduler` — scheduled job trigger sidecar.

Production deployments can split these into separate services, but keep the same boundaries: app traffic goes to the Next.js service, and SES/SNS event webhooks go to the ingester.

## Quick start

```bash
git clone https://github.com/namuh-eng/opensend.git
cd opensend
cp .env.example .env
# Edit .env for real Google OAuth, SES, S3, and Cloudflare DNS.
docker compose up -d
```

Open `http://localhost:3015`.

## Required configuration

Minimum local development values:

```env
DATABASE_URL=postgres://...
BETTER_AUTH_SECRET=...
BETTER_AUTH_URL=http://localhost:3015
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
S3_BUCKET_NAME=...
```

For Google sign-in, add your Google OAuth client ID and secret. For automatic DNS setup, add Cloudflare credentials. Production deployments should inject secrets at runtime from a secrets manager instead of baking them into images.

## Migrations

Run database migrations before deploying app code that expects new tables or columns:

```bash
bun run db:migrate
```

For local schema sync during development, use:

```bash
bun run db:push
```

If list pages work but detail pages 404 or return empty data after a deploy, check for a swallowed schema mismatch before assuming a route is missing.

## SES and ingester wiring

OpenSend sends through AWS SES v2. SES/SNS events should be delivered to the ingester service, not the app service:

```txt
https://YOUR_INGESTER_HOST/events/ses
```

The ingester handles delivery, bounce, complaint, open, click, received-email, and scheduled-send processing. See [Ingester Deploy](/docs/ingester-deploy) for the dedicated deployment checklist.

## Domain verification

Sending domains need DNS records for DKIM, SPF, DMARC, bounce handling, and optional tracking. You can copy records manually from the dashboard, or configure Cloudflare credentials for automatic setup where supported.

## Build and deploy notes

- Build Linux production images for `linux/amd64` unless your runtime explicitly uses another platform.
- Use `bun install --ignore-scripts` in Docker dependency stages if postinstall scripts are unavailable there.
- Keep Next.js middleware on the Node runtime when importing node-only packages such as Redis clients.
- Keep `/docs`, `/docs/llms.txt`, and `/openapi.json` publicly reachable.

## Validation checklist

Before cutting over production traffic:

1. `make check`
2. `make test`
3. `bun run build`
4. `bun run db:migrate` against the target database
5. `GET /api/health` returns healthy
6. A real SES-backed send produces a non-null `sent_at`
7. CloudWatch or service logs show SES send success, not a development stub
8. SES/SNS events reach the ingester `/events/ses` endpoint

