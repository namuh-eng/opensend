# Ingester deployment runbook

Issue #70 splits SES/SNS ingestion into its own container and ECS/Fargate service so webhook bursts do not contend with the Next.js app.

## Local docker-compose

Start the full stack:

```bash
docker compose up --build app ingester postgres migrate
```

Endpoints:

- App: `http://localhost:${PORT:-3015}`
- Ingester health: `http://localhost:${INGESTER_PORT:-3016}/health`
- SES SNS webhook target: `http://localhost:${INGESTER_PORT:-3016}/events/ses`

Check the ingester container:

```bash
docker compose ps ingester
docker compose logs -f ingester
```

## Production deploy shape

Team production runs on AWS ECS/Fargate behind the shared `namuh` ALB.
`bash scripts/deploy.sh` deploys two long-running services and a one-off
migrator task:

- app image from `Dockerfile`
- migrator image from the `Dockerfile` `migrator` target, pushed to the app ECR repo as `<tag>-migrator`
- ingester image from `packages/ingester/Dockerfile`

Supported targets:

```bash
bash scripts/deploy.sh migrate   # DB-only migration/repair
bash scripts/deploy.sh app       # app image + migrations + app service redeploy
bash scripts/deploy.sh ingester  # ingester image + migrations + ingester service redeploy
bash scripts/deploy.sh all       # app + ingester images + migrations + both redeploys
```

Override names when production service or repository names differ from repo defaults:

```bash
PRODUCT=opensend \
ECS_CLUSTER=namuh \
IMAGE_TAG=latest \
PLATFORM=linux/amd64 \
bash scripts/deploy.sh all
```

Do not bypass the script with a raw `aws ecs update-service` after schema
changes. The script runs migrations before service redeploys so app code does
not start against an older database schema.

## Background job worker

Issues #15/#16 move send/webhook work to AWS-native background jobs. The app publishes jobs to SQS after persisting rows; the ingester service consumes and executes them. Email rows start as `queued`, transition through worker-owned `processing`/`sent`, and get `sent_at` only after SES accepts the message.

Required production environment for both app and ingester:

```bash
BACKGROUND_JOBS_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/<account>/opensend-background
BACKGROUND_JOBS_REQUIRE_QUEUE=true
BACKGROUND_JOBS_EVENT_BUS_NAME=opensend-background-jobs # optional lifecycle/event hook bus
CLOUDWATCH_METRICS_NAMESPACE=Opensend # optional EMF namespace override
```

Set this only on the ingester worker service when SQS is ready:

```bash
BACKGROUND_WORKER_POLL=true
INGESTER_JOB_TOKEN=<random-bearer-token-for-eventbridge-http-targets>
```

SQS requirements:

- configure a redrive policy and DLQ; worker failures leave messages undeleted so SQS owns retry exhaustion
- use a standard queue by default; FIFO is supported if the queue URL ends in `.fifo`
- grant the app `sqs:SendMessage` and optional `events:PutEvents`
- grant the ingester `sqs:ReceiveMessage`, `sqs:DeleteMessage`, `sqs:ChangeMessageVisibility`, and SES send permissions

EventBridge scheduling:

- call `POST /jobs/scheduled-emails` every minute to enqueue due scheduled sends
- call `POST /jobs/webhooks` every minute to retry webhook deliveries whose `next_retry_at` has arrived
- alternatively publish `scheduled-email.scan` and `webhook-delivery.scan` jobs into SQS

Manual probes:

```bash
INGESTER_URL="https://<ingester-service-url>"
curl -i -X POST "${INGESTER_URL}/jobs/poll" \
  -H "Authorization: Bearer ${INGESTER_JOB_TOKEN}"
curl -i -X POST "${INGESTER_URL}/jobs/scheduled-emails" \
  -H "Authorization: Bearer ${INGESTER_JOB_TOKEN}"
curl -i -X POST "${INGESTER_URL}/jobs/webhooks" \
  -H "Authorization: Bearer ${INGESTER_JOB_TOKEN}"
```

## SNS cutover

After the ingester service is live, SES SNS should point at:

```text
https://<ingester-service-url>/events/ses
```

Do not leave SES pointed at the Next.js app URL once the split is active.

## Observability

The app and ingester emit structured JSON logs, W3C/OpenTelemetry-compatible trace context, and CloudWatch EMF metrics for queue depth, worker failures, retry count, send latency, send outcomes, and SES ingest results. Use `docs/observability.md` for metric names, PII-safe logging rules, and the full API-to-provider tracing runbook.

## Tail ingester logs

Tail the ECS CloudWatch log group:

```bash
aws logs tail /ecs/opensend-ingester --region us-east-1 --since 10m --follow
```

Check recent ECS service events:

```bash
aws ecs describe-services \
  --cluster namuh \
  --services opensend-ingester \
  --region us-east-1 \
  --query 'services[0].events[0:10].message' \
  --output table
```

## Force-process a missed SES event

The ingester verifies the original SNS signature, so the safe replay path is to resend the exact SNS notification body that AWS originally delivered.

```bash
INGESTER_URL="https://<ingester-service-url>/events/ses"
curl -i "${INGESTER_URL}" \
  -H "Content-Type: text/plain; charset=UTF-8" \
  -H "x-amz-sns-message-type: Notification" \
  --data @sns-notification.json
```

`sns-notification.json` must be a real captured SNS envelope, including the original `Signature`, `SigningCertURL`, and `MessageId` fields. Because `email_events.source_id` is idempotent on the SNS `MessageId`, an already-processed notification will return `200 OK` and no-op.

## External residuals

This repo change does not create or mutate external AWS resources on its own. Before production cutover, verify:

- the ingester ECR repository exists
- the app, ingester, and migrator ECS tasks have shared RDS and Secrets Manager wiring
- the SQS queue exists with a redrive policy and DLQ
- EventBridge schedule/rules exist for scheduled-email and webhook retry scans
- IAM grants app publish permissions and ingester consume/delete/change-visibility permissions
- the SES SNS subscription has been updated to the ingester URL
