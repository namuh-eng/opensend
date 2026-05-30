# Ingester service deployment

The production ingester is the Bun/Hono service in `packages/ingester`. It is a standalone process that handles two things:

1. SES/SNS event ingestion at `POST /events/ses`
2. Background job execution (queued email sends, scheduled-email scans,
   webhook dispatch, webhook retry scans, and domain verification reconciliation)

In Docker Compose it runs side-by-side with the app. In production we strongly
recommend running it as a **separate service** so webhook bursts and worker
stalls don't contend with dashboard requests.

For the broader self-host setup, see [`self-hosting.md`](self-hosting.md).
This document focuses on the operational shape of the split-service
deployment.

## Local Docker Compose

```bash
docker compose up --build app ingester postgres migrate
```

Endpoints:

- App: `http://localhost:${PORT:-3015}`
- Ingester health: `http://localhost:${INGESTER_PORT:-3016}/health`
- SES SNS webhook target: `http://localhost:${INGESTER_PORT:-3016}/events/ses`
- Stripe billing webhook target: `http://localhost:${INGESTER_PORT:-3016}/webhooks/stripe`

```bash
docker compose ps ingester
docker compose logs -f ingester
```

## Production shape

Two services from the same repo, both connecting to the same Postgres, Redis,
and SQS:

| Service | Image source | Public host (example) | Port |
| --- | --- | --- | --- |
| App | `Dockerfile` (default target) | `app.yourdomain.com` and `api.app.yourdomain.com` | `8080` |
| Ingester | `packages/ingester/Dockerfile` | `events.app.yourdomain.com` | `3016` |

If your platform has host-based routing (AWS ALB, GCP Load Balancer, Cloudflare
Spectrum), point each hostname at its target service. The events host has to
be reachable from the public internet so SES SNS can deliver to it.

Build images for `linux/amd64` even from M-chip Macs:

```bash
docker buildx build --platform linux/amd64 \
  -t yourorg/opensend-app:latest --push .

docker buildx build --platform linux/amd64 \
  -f packages/ingester/Dockerfile \
  -t yourorg/opensend-ingester:latest --push .
```

Run a one-shot migrator container against the production `DATABASE_URL`
**before** redeploying the app or ingester when the change includes schema
migrations:

```bash
docker buildx build --platform linux/amd64 --target migrator \
  -t yourorg/opensend-migrator:latest --push .

# Run once against production DB
docker run --rm --env DATABASE_URL=... yourorg/opensend-migrator:latest
```

## Background job worker

The app publishes jobs to SQS after persisting rows; the ingester consumes
them. Email rows start as `queued`, transition through worker-owned
`processing`/`sent`, and get `sent_at` only after SES accepts the message.

Required environment for **both** the app and ingester:

```bash
BACKGROUND_JOBS_QUEUE_URL=https://sqs.<region>.amazonaws.com/<account>/<queue-name>
BACKGROUND_JOBS_REQUIRE_QUEUE=true
BACKGROUND_JOBS_EVENT_BUS_NAME=<event-bus-name>   # optional lifecycle bus
CLOUDWATCH_METRICS_NAMESPACE=Opensend             # optional EMF namespace
```

Set these on the ingester service:

```bash
BACKGROUND_WORKER_POLL=true
INGESTER_JOB_TOKEN=<32+-char-random-bearer-token>
# Required only when using /events/inbound in production.
INGESTER_INBOUND_TOKEN=<32+-char-random-bearer-token>
```

For hosted Stripe billing cutover, also set these on the ingester service from
the deployment secret manager:

```bash
BILLING_BACKEND=stripe
STRIPE_SECRET_KEY=<from-secret-manager>
STRIPE_WEBHOOK_SECRET=<stripe-webhook-signing-secret>
BILLING_NOTIFICATION_FROM_EMAIL=billing@yourdomain.com # optional
```

The Stripe webhook endpoint is:

```text
https://events.yourdomain.com/webhooks/stripe
```

Run `bun run billing:preflight -- --service ingester` in the release
environment before sending Stripe traffic to the endpoint. See
[`hosted-stripe-cutover.md`](hosted-stripe-cutover.md) for the full validation
checklist.

Set the same 32+ character `INGESTER_JOB_TOKEN` on any scheduler that calls `/jobs/*`; production ingesters reject missing job tokens. Compose also accepts an optional scheduler cadence override:

```bash
INGESTER_SCHEDULER_INTERVAL_SECONDS=60
```

### SQS requirements

- Configure a redrive policy with a DLQ. Worker failures leave messages
  undeleted so SQS owns retry exhaustion.
- Standard queue is fine; FIFO works if the URL ends in `.fifo`.
- Grant the **app** principal `sqs:SendMessage` and (if used) `events:PutEvents`.
- Grant the **ingester** principal `sqs:ReceiveMessage`, `sqs:DeleteMessage`,
  `sqs:ChangeMessageVisibility`, and the SES send permissions.

### Periodic scans

Three scans need to run every minute: `/jobs/scheduled-emails`, `/jobs/webhooks`, and `/jobs/domain-verify`. The Docker Compose `scheduler` sidecar runs all three by default. For managed production, use one of these patterns:

**HTTP-driven** (e.g. AWS EventBridge schedule rule with HTTP target, or any
cron driver that can issue authenticated POSTs):

```bash
INGESTER_URL="https://events.yourdomain.com"
curl -i -X POST "${INGESTER_URL}/jobs/scheduled-emails" \
  -H "Authorization: Bearer ${INGESTER_JOB_TOKEN}"
curl -i -X POST "${INGESTER_URL}/jobs/webhooks" \
  -H "Authorization: Bearer ${INGESTER_JOB_TOKEN}"
curl -i -X POST "${INGESTER_URL}/jobs/domain-verify" \
  -H "Authorization: Bearer ${INGESTER_JOB_TOKEN}"
```

**Queue-driven**: publish `scheduled-email.scan` and `webhook-delivery.scan`
SQS messages on the same minute cadence; the ingester picks them up via the
normal long-poll loop. Domain verification is HTTP-only today, so keep an HTTP schedule for `/jobs/domain-verify`.

Manual probes during a deploy:

```bash
INGESTER_URL="https://events.yourdomain.com"
curl -i -X POST "${INGESTER_URL}/jobs/poll" \
  -H "Authorization: Bearer ${INGESTER_JOB_TOKEN}"
curl -i -X POST "${INGESTER_URL}/jobs/domain-verify" \
  -H "Authorization: Bearer ${INGESTER_JOB_TOKEN}"
```

## SNS cutover

After the ingester service is healthy and reachable on a public host, the
SES SNS should point at the ingester's events host:

```text
https://events.yourdomain.com/events/ses
```

Update the SES configuration set's SNS topic subscription accordingly. The
ingester verifies the SNS signature, so no shared secret is needed.

Don't leave SES pointing at the app/API host once the split is active —
events would be processed by the dashboard's request loop instead of the
worker.

## Observability

The app and ingester emit structured JSON logs, W3C/OpenTelemetry-compatible
trace context, and CloudWatch EMF metrics for queue depth, worker failures,
retry counts, send latency, send outcomes, and SES ingest results. See
[`observability.md`](observability.md) for the metric catalog, PII rules, and
end-to-end tracing runbook.

If you're on AWS, tail the ingester logs:

```bash
aws logs tail /ecs/<ingester-log-group> --since 10m --follow
```

## Replay a missed SES SNS event

The ingester verifies the original SNS signature, so the safe replay path is
to resend the exact SNS notification body that AWS originally delivered.

```bash
INGESTER_URL="https://events.yourdomain.com/events/ses"
curl -i "${INGESTER_URL}" \
  -H "Content-Type: text/plain; charset=UTF-8" \
  -H "x-amz-sns-message-type: Notification" \
  --data @sns-notification.json
```

`sns-notification.json` must be a captured SNS envelope, including the
original `Signature`, `SigningCertURL`, and `MessageId` fields. Because
`email_events.source_id` is idempotent on the SNS `MessageId`, an
already-processed notification returns `200 OK` and no-ops.

## Pre-cutover checklist

Before pointing production SES SNS at a freshly stood-up ingester, verify:

- The ingester image is built for `linux/amd64` and pushed to your registry.
- The app ECS task definition injects `WEBHOOK_SECRET_ENCRYPTION_KEY` from the
  deployment secret manager. For the repo deploy script, create or point
  `WEBHOOK_SECRET_ENCRYPTION_KEY_SECRET_ID` /
  `WEBHOOK_SECRET_ENCRYPTION_KEY_SECRET_ARN` at that AWS Secrets Manager secret
  before running `scripts/deploy.sh app` or `scripts/deploy.sh all`.
- The ingester service has the same `DATABASE_URL`, AWS credentials, SQS
  config, Redis URL, and `INGESTER_JOB_TOKEN` as the app.
- The events host (`events.<your-domain>`) resolves and serves a 200 on
  `/health`.
- If hosted billing is enabled, Stripe Dashboard points to
  `https://events.<your-domain>/webhooks/stripe` and the ingester has
  `BILLING_BACKEND=stripe`, `STRIPE_SECRET_KEY`, and `STRIPE_WEBHOOK_SECRET`.
- The SQS queue exists with a redrive policy + DLQ.
- Periodic scan rules (`/jobs/scheduled-emails`, `/jobs/webhooks`, `/jobs/domain-verify`) are scheduled on a 1-minute cadence and use `Authorization: Bearer ${INGESTER_JOB_TOKEN}`.
- Domain verification runbook passed: create/use a pending domain, confirm SES is verified, do not click **Verify DNS Records**, wait for the scheduler, and confirm the OpenSend DB/dashboard flips to `verified`.
- Migrations ran successfully against the production database before the new
  image started.
- Rolling back is possible: keep the previous image tag pinned somewhere you
  can redeploy from.
