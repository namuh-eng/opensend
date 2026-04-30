# Ingester deployment runbook

The standalone ingester receives SES/SNS events and owns background worker execution so webhook bursts and queued email sends do not contend with the Next.js app. Team production runs the ingester as an AWS ECS Fargate service behind the shared `namuh-alb` Application Load Balancer.

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

## Production ECS Fargate shape

Production is AWS ECS Fargate in `us-east-1`:

- ECS cluster: `namuh`
- ALB: `namuh-alb`, shared across products with host-based listener rules
- ECR repos: `<product>-app` and `<product>-ingester`
- ECS services: `<product>-app` and `<product>-ingester`
- CloudWatch log groups: `/ecs/<product>-app` and `/ecs/<product>-ingester`

The ALB listener routes by hostname:

| Host | Target service | Target port |
| --- | --- | --- |
| `<product>.namuh.co` | app/dashboard | `8080` |
| `api.<product>.namuh.co` | app/API | `8080` |
| `events.<product>.namuh.co` | ingester | `3016` |

For the current Opensend deployment, the ingester public endpoint is:

```text
https://events.opensend.namuh.co/events/ses
```

The Fargate task definition must expose/container-map the ingester on port `3016`, and the `events.<product>.namuh.co` ALB rule must forward to the ingester target group on port `3016`.

## Deploy the ingester

Use `scripts/deploy.sh` rather than a raw `aws ecs update-service`. The Fargate deploy script contract is:

- build `packages/ingester/Dockerfile` for `linux/amd64`
- push the image to ECR repo `<product>-ingester`
- force a new deployment of ECS service `<product>-ingester` in cluster `namuh`
- wait for `aws ecs wait services-stable` before reporting success

Deploy only the ingester:

```bash
PRODUCT=opensend \
ECS_CLUSTER=namuh \
IMAGE_TAG=latest \
PLATFORM=linux/amd64 \
bash scripts/deploy.sh ingester
```

Supported deploy targets:

```bash
bash scripts/deploy.sh app       # app image + app service redeploy
bash scripts/deploy.sh ingester  # ingester image + ingester service redeploy
bash scripts/deploy.sh all       # app + ingester images + both redeploys
```

The deploy script assumes the ECS services, target groups, listener rules, log groups, ECR repositories, and Secrets Manager wiring already exist. Use this runbook's external residuals checklist when bringing up a new product or debugging a failed deployment.

## Background job worker

The app publishes jobs to SQS after persisting rows; the ingester service consumes and executes them. Email rows start as `queued`, transition through worker-owned `processing`/`sent`, and get `sent_at` only after SES accepts the message.

Required production environment for both app and ingester:

```bash
BACKGROUND_JOBS_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/<account>/<product>-background
BACKGROUND_JOBS_REQUIRE_QUEUE=true
BACKGROUND_JOBS_EVENT_BUS_NAME=<product>-background-jobs # optional lifecycle/event hook bus
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
INGESTER_URL="https://events.<product>.namuh.co"
curl -i -X POST "${INGESTER_URL}/jobs/poll" \
  -H "Authorization: Bearer ${INGESTER_JOB_TOKEN}"
curl -i -X POST "${INGESTER_URL}/jobs/scheduled-emails" \
  -H "Authorization: Bearer ${INGESTER_JOB_TOKEN}"
curl -i -X POST "${INGESTER_URL}/jobs/webhooks" \
  -H "Authorization: Bearer ${INGESTER_JOB_TOKEN}"
```

## SNS cutover

After the Fargate ingester service is healthy behind the ALB, SES SNS should point at the host-based `events` route:

```text
https://events.<product>.namuh.co/events/ses
```

For Opensend production:

```text
https://events.opensend.namuh.co/events/ses
```

Do not leave SES pointed at the Next.js app/API host once the split is active.

## Observability

The app and ingester emit structured JSON logs, W3C/OpenTelemetry-compatible trace context, and CloudWatch EMF metrics for queue depth, worker failures, retry count, send latency, send outcomes, and SES ingest results. Use `docs/observability.md` for metric names, PII-safe logging rules, and the full API-to-provider tracing runbook.

## Tail ingester logs

Tail the ECS CloudWatch log group for the ingester service:

```bash
PRODUCT=opensend
aws logs tail "/ecs/${PRODUCT}-ingester" \
  --region us-east-1 \
  --since 10m \
  --follow
```

Check recent ECS service events when a deploy or health check is failing:

```bash
PRODUCT=opensend
aws ecs describe-services \
  --cluster namuh \
  --services "${PRODUCT}-ingester" \
  --region us-east-1 \
  --query 'services[0].events[0:10].message' \
  --output table
```

## Replay a missed SES SNS event

The ingester verifies the original SNS signature, so the safe replay path is to resend the exact SNS notification body that AWS originally delivered to the Fargate endpoint.

```bash
INGESTER_URL="https://events.<product>.namuh.co/events/ses"
curl -i "${INGESTER_URL}" \
  -H "Content-Type: text/plain; charset=UTF-8" \
  -H "x-amz-sns-message-type: Notification" \
  --data @sns-notification.json
```

`sns-notification.json` must be a real captured SNS envelope, including the original `Signature`, `SigningCertURL`, and `MessageId` fields. Because `email_events.source_id` is idempotent on the SNS `MessageId`, an already-processed notification will return `200 OK` and no-op.

## External residuals

This repo change does not create or mutate external AWS resources on its own. Before production cutover or a new product launch, verify:

- the `<product>-ingester` ECR repository exists
- the `<product>-ingester` ECS service exists in cluster `namuh`
- the ingester task definition has the same RDS, AWS, Cloudflare, queue, and token secrets as production requires
- the ALB listener has a host-based rule for `events.<product>.namuh.co`
- the ingester target group forwards to port `3016` and has a passing health check
- the SQS queue exists with a redrive policy and DLQ
- EventBridge schedule/rules exist for scheduled-email and webhook retry scans
- IAM grants app publish permissions and ingester consume/delete/change-visibility permissions
- the SES SNS subscription has been updated to `https://events.<product>.namuh.co/events/ses`
