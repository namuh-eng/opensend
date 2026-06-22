# Production alerts runbook

OpenSend production alerting is managed by the committed reconciler at
`scripts/create-cloudwatch-alarms.ts`. It is dry-run by default and only mutates
AWS when `--apply` is supplied. CloudWatch alarm actions point at an SNS topic
ARN; email delivery is an SNS email subscription and the recipient must confirm
that subscription before messages are delivered.

## Setup command

Preview the desired alarm set without mutating AWS:

```bash
bun run scripts/create-cloudwatch-alarms.ts \
  --env production \
  --region us-east-1 \
  --sns-topic-arn arn:aws:sns:us-east-1:123456789012:opensend-ops-alerts \
  --dlq-queue-name opensend-production-dlq \
  --scheduler-interval-seconds 60 \
  --ecs-service namuh/opensend-app/1 \
  --ecs-service namuh/opensend-ingester/1 \
  --ecs-service namuh/opensend-scheduler/1 \
  --json
```

Apply only after reviewing the dry-run:

```bash
bun run scripts/create-cloudwatch-alarms.ts ... --apply
```

Delete stale alarms only after reviewing the stale candidates:

```bash
bun run scripts/create-cloudwatch-alarms.ts ... --apply --delete-stale-managed-alarms
```

If you need email alerts and do not already have an SNS topic, pass
`--sns-topic-name opensend-ops-alerts --subscription-email you@example.com`.
If you already have a topic, pass `--sns-topic-arn ... --subscription-email ...`;
the script subscribes the address when `--apply` is present. SNS confirmation
required: the email recipient must confirm the SNS subscription before alarms can
reach that mailbox.

All alarm actions use one SNS topic by default. Keep severity/channel fanout in
SNS, AWS Chatbot, or an SNS-to-Lambda bridge so Discord/webhook secrets stay in
AWS rather than the repo.

## Alarm catalog

| Alarm | Watches | Threshold intent | First response | False-positive notes |
| --- | --- | --- | --- | --- |
| `*-send-failures-present` | `SendFailed` (`Service=worker`, `Operation=ses.send`) | Any provider send failure in 5 minutes | Check worker logs for `email.send.failed`, inspect SES region/domain verification, missing secrets such as tracking keys, and email retry/dead-letter metadata. | Low-volume systems can alert on one expected provider outage; rate-based alerting is a follow-up once exact dimensions and minimum volume are implemented. |
| `*-queue-publish-failures-api`, `*-queue-publish-failures-ingester`, `*-queue-publish-failures-worker` | `QueuePublishFailed` by service | Any SQS publish failure in 5 minutes | Confirm `BACKGROUND_JOBS_QUEUE_URL`, AWS credentials, SQS permissions, and SQS regional availability. | Local/dev without a required queue should not apply production alarms. |
| `*-queue-publish-skipped-api`, `*-queue-publish-skipped-ingester`, `*-queue-publish-skipped-worker` | `QueuePublishSkipped` by service | Any skipped publish due to missing queue URL in 5 minutes | Confirm `BACKGROUND_JOBS_QUEUE_URL` is set everywhere and `BACKGROUND_JOBS_REQUIRE_QUEUE=true` is enforced in production. | Expected in local Docker-friendly development; production should treat it as configuration drift. |
| `*-worker-job-failures-present` | `WorkerJobFailed` | Any thrown worker job failure or terminal provider failure in 5 minutes | Inspect worker logs by `correlation_id`/`trace_id`; check retries, SES errors, webhook dispatcher failures, and DB connectivity. | Transient provider throttling can page before SQS retries recover; tune after real traffic data. |
| `*-dlq-messages-present` | SQS DLQ visible message count | Any visible DLQ message | Stop new replay attempts, inspect message body safely, identify original job type, and choose manual replay or discard path. | Requires the correct DLQ queue name; a wrong QueueName creates a silent/non-useful alarm. |
| `*-scheduler-heartbeat-missed` | `SchedulerHeartbeat` | No scheduler batch heartbeat for about five configured scheduler periods | Check scheduler ECS task/service, `INGESTER_URL`, `INGESTER_JOB_TOKEN`, container logs, and recent deploys. | Pass `--scheduler-interval-seconds` if production changes `INGESTER_SCHEDULER_INTERVAL_SECONDS`; the 2026-06-11 manual `scheduler-running-tasks-low` alarm depended on Container Insights data, while this heartbeat alarm additionally proves the scheduler process is running. |
| `*-scheduler-job-failures-present` | `SchedulerJobFailed` | Any scheduler job non-2xx/timeout | Check `/jobs/scheduled-emails`, `/jobs/webhooks`, and `/jobs/domain-verify` responses, ingester auth, and job endpoint logs. | A single temporarily slow ingester can alert once; use logs to confirm persistence. |
| `*-ses-ingest-failures-present` | `SesEventIngestFailed` | Any SES/SNS ingest exception | Check ingester `/events/ses` logs, SNS signature validation, SES notification shape, DB writes, and webhook enqueue failures. | Invalid SNS signatures should be investigated but can be caused by test endpoints. |
| `*-running-tasks-low` | ECS Container Insights `RunningTaskCount` | Running task count below configured desired count | Check ECS service events, task health, image pull failures, secrets injection, migrations, and recent deploys. | Requires ECS Container Insights. The 2026-06-11 issue comment noted false alarms when Container Insights was disabled/missing data. |
| `*-unhealthy-hosts` | ALB `UnHealthyHostCount` | Any unhealthy target | Check target group health reasons, app/ingester `/health`, security groups, listener rules, and container ports. | Only apply when ALB `LoadBalancer` and `TargetGroup` dimensions are exact. |
| `*-target-5xx` | ALB `HTTPCode_Target_5XX_Count` | Configurable target 5xx count, default 5 in 5 minutes | Inspect app/ingester logs and recent deploys; correlate with API request logs. | Bursty deploys or probes can cause one-off 5xx spikes; tune threshold after baseline data. |

## Exact-dimension rule

CloudWatch EMF custom metrics are identified by namespace, metric name, and the
exact dimension set emitted in the log event. Do not alarm on partial dimensions.
OpenSend therefore keeps detailed metrics such as `SendOutcome`, `QueuePublish`,
and `WorkerFailures` for drill-down, and emits alarm-friendly aggregate metrics
(`SendFailed`, `QueuePublishFailed`, `QueuePublishSkipped`,
`WorkerJobFailed`) in separate EMF calls.

## Known follow-ups

- Send failure rate alerting is intentionally documented as a follow-up. This
  issue closes send alerting with failed-count alarms because rate math must use
  exact dimensions and a minimum-volume guard to avoid false positives.
- Discord delivery should be implemented outside this repo through SNS Chatbot or
  an SNS-to-Lambda bridge with secrets stored in AWS, not committed here.
