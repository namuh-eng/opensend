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
| App | `ghcr.io/namuh-eng/opensend:v1.0.0`; use `docker-compose.local.yml` or your own registry tag when building from source | `app.yourdomain.com` and `api.app.yourdomain.com` | `8080` |
| Ingester | `ghcr.io/namuh-eng/opensend-ingester:v1.0.0`; scheduler uses the same image with `bun /app/job-scheduler.js` | `events.app.yourdomain.com` | `3016` |

If your platform has host-based routing (AWS ALB, GCP Load Balancer, Cloudflare
Spectrum), point each hostname at its target service. The events host has to
be reachable from the public internet so SES SNS can deliver to it.

The GitHub release workflow publishes the official app and ingester images on
`v*` tags. The default `docker-compose.yml` pins those app, ingester, and
scheduler tags for reproducible self-host deploys. The ingester process only
consumes the image at runtime; it does not publish Docker images. The workflow
publishes `:v1.0.0` and `:1.0.0` tags and intentionally does not publish
`:latest`, so production deployments should pin the exact release tag they have
validated.

For forks, private registries, or pre-release validation, build images yourself.
Use `linux/amd64` for amd64 production targets even from M-chip Macs, or include
both supported release platforms when you need a multi-arch manifest:

```bash
docker buildx build --platform linux/amd64,linux/arm64 \
  --target runner \
  -t yourorg/opensend-app:v1.0.0 --push .

docker buildx build --platform linux/amd64,linux/arm64 \
  -f packages/ingester/Dockerfile \
  -t yourorg/opensend-ingester:v1.0.0 --push .

docker buildx imagetools inspect yourorg/opensend-app:v1.0.0
docker buildx imagetools inspect yourorg/opensend-ingester:v1.0.0
```

Run a one-shot migrator container against the production `DATABASE_URL`
**before** redeploying the app or ingester when the change includes schema
migrations. The v1.0.0 release workflow does not publish a separate migrator
image, so build the root Dockerfile `migrator` target into your registry when
your platform needs an image-only migration job:

```bash
docker buildx build --platform linux/amd64 --target migrator \
  -t yourorg/opensend-migrator:v1.0.0 --push .

# Run once against production DB
docker run --rm --env DATABASE_URL=... yourorg/opensend-migrator:v1.0.0
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
# Required for hosted-style SES receiving rule provisioning.
SES_INBOUND_SNS_TOPIC_ARN=arn:aws:sns:<region>:<account>:opensend-inbound-mail
# Optional allowlist for SES receipt-rule S3 ingestion. Defaults to S3_BUCKET_NAME.
SES_INBOUND_BUCKET_NAME=<private-raw-mail-bucket>
# Optional; defaults to opensend-inbound.
SES_INBOUND_RULE_SET_NAME=opensend-inbound
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

## Inbound receiving through SES receipt rules

For hosted receiving, OpenSend creates one SES receipt rule per receiving-enabled domain. Route AWS SES receipt-rule notifications to the ingester instead of building a separate mailbox service. The supported production path is:

1. SES receipt rule accepts mail for the receiving domain.
2. The rule stores the raw MIME object in a private S3 bucket.
3. The rule publishes an SNS notification for the S3 action.
4. SNS delivers the signed notification to:

```text
https://events.yourdomain.com/events/inbound/ses-s3
```

The ingester verifies the SNS signature, checks the receipt notification's S3 bucket against `SES_INBOUND_BUCKET_NAME` or `S3_BUCKET_NAME`, reads the raw MIME object, then calls the same inbound MIME ingestion service as `POST /events/inbound`. That means receiving routes, quota accounting, attachment storage, forwarding, reply threading, and `email.received` webhook queueing all use one code path.

Minimum AWS wiring:

```bash
aws sns create-topic --name opensend-inbound-mail
aws sns subscribe \
  --topic-arn <topic-arn> \
  --protocol https \
  --notification-endpoint https://events.yourdomain.com/events/inbound/ses-s3
```

Set `SES_INBOUND_SNS_TOPIC_ARN=<topic-arn>` on the app and ingester. Set `S3_BUCKET_NAME` or `SES_INBOUND_BUCKET_NAME=<private-raw-mail-bucket>` on the app and ingester. The app creates and activates the `SES_INBOUND_RULE_SET_NAME` rule set, default `opensend-inbound`, and upserts a receipt rule when the dashboard receiving toggle is enabled.

Also grant SES permission to write to the bucket and SNS permission to publish from SES in your account/region. Keep the bucket private; OpenSend stores parsed attachment bodies through its normal storage boundary after ingestion.

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

Four scans need to run every minute: `/jobs/scheduled-emails`, `/jobs/webhooks`, `/jobs/domain-verify`, and `/jobs/billing-overage`. The Docker Compose `scheduler` sidecar runs all four by default. For managed production, use one of these patterns:

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
curl -i -X POST "${INGESTER_URL}/jobs/billing-overage" \
  -H "Authorization: Bearer ${INGESTER_JOB_TOKEN}"
```

**Queue-driven**: publish `scheduled-email.scan` and `webhook-delivery.scan`
SQS messages on the same minute cadence; the ingester picks them up via the
normal long-poll loop. Domain verification and billing overage reporting are HTTP-only today, so keep an HTTP schedule for `/jobs/domain-verify` and `/jobs/billing-overage`.

Manual probes during a deploy:

```bash
INGESTER_URL="https://events.yourdomain.com"
curl -i -X POST "${INGESTER_URL}/jobs/poll" \
  -H "Authorization: Bearer ${INGESTER_JOB_TOKEN}"
curl -i -X POST "${INGESTER_URL}/jobs/domain-verify" \
  -H "Authorization: Bearer ${INGESTER_JOB_TOKEN}"
curl -i -X POST "${INGESTER_URL}/jobs/billing-overage" \
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

## Deliverability feedback preflight and repair

Delivery, bounce, complaint, and delivery-delay dashboard metrics require each
sending domain's SES configuration set to publish provider events to the
ingester SNS topic. Configure both the app and ingester runtime with:

```bash
SES_EVENTS_SNS_TOPIC_ARN=arn:aws:sns:<region>:<account>:<topic-name>
```

Run the read-only preflight before redeploying or repairing production:

```bash
bun run deliverability:preflight -- --domain example.com --json --strict
```

The report lists verified domains, the previous
`domains.ses_configuration_set_name` value, the resulting value, whether the
database write-back exists, and the SES event-destination state. It does not
print secrets.

After IAM, SNS topic subscription, and app/ingester runtime env are in place, repair a
single domain first:

```bash
bun run deliverability:preflight -- --repair --domain example.com --json --strict
```

Then repair the verified-domain batch:

```bash
bun run deliverability:preflight -- --repair --limit 500 --json --strict
```

Live validation for a production incident should prove all of these boundaries:

- IAM on the app task role allows SES configuration-set and event-destination
  read/create/update actions.
- `SES_EVENTS_SNS_TOPIC_ARN` is present on the app and ingester task definitions.
- SES shows the `opensend-sns-events` destination enabled on the repaired
  configuration set and pointing at the SNS topic.
- The repaired domain row has `ses_configuration_set_name` populated.
- A new validation send carries `X-Entity-ID`/SES message tag correlation,
  creates an `email_events` row with `user_id`, and appears in the Today or
  Metrics dashboard without showing the provider-feedback **Not wired** state.

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
  `BILLING_BACKEND=stripe`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and the configured Stripe overage meter event name. Overage reporting is skipped when billing is disabled; when enabled, the `/jobs/billing-overage` job uses the `billing_overage_reports` outbox table to retry/catch up reported deltas without double-counting. The automatic catch-up scan covers billing periods that ended within the last 30 days; older missed usage requires manual Stripe reconciliation before invoice close.
- The SQS queue exists with a redrive policy + DLQ.
- Periodic scan rules (`/jobs/scheduled-emails`, `/jobs/webhooks`, `/jobs/domain-verify`, `/jobs/billing-overage`) are scheduled on a 1-minute cadence and use `Authorization: Bearer ${INGESTER_JOB_TOKEN}`.
- Domain verification runbook passed: create/use a pending domain, confirm SES is verified, do not click **Verify DNS Records**, wait for the scheduler, and confirm the OpenSend DB/dashboard flips to `verified`.
- Migrations ran successfully against the production database before the new
  image started.
- Rolling back is possible: keep the previous image tag pinned somewhere you
  can redeploy from.
