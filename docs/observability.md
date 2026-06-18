# Observability runbook

Opensend emits an AWS-first observability baseline for the email accept and delivery flow. The implementation uses structured JSON logs, W3C/OpenTelemetry-compatible `traceparent` propagation, and CloudWatch Embedded Metric Format (EMF) records so the same application logs can drive CloudWatch Logs and Metrics.

## Telemetry model

Every instrumented request/job has:

- `correlation_id` — stable identifier for support/debugging. API callers can provide `x-correlation-id`; otherwise Opensend derives one from the trace id.
- `trace_id`, `span_id`, `parent_span_id`, `traceparent`, `tracestate` — W3C trace context fields that keep API, SQS, worker, SES, and webhook jobs connected.
- `event` — machine-readable log event such as `email.accepted`, `queue.publish`, `worker.email.send`, or `ses.event.received`.
- low-cardinality metric dimensions only: `Service`, `Operation`, `Outcome`, `JobType`, and `EventType`.

The API response for `POST /api/emails` and `POST /api/emails/batch` includes `x-correlation-id` and `traceparent`. Background jobs persist the same carrier under the job `trace` field and also publish `correlationId` / `traceparent` SQS message attributes.

## PII-safe logging rules

Do not log raw email content or recipient data. The shared telemetry sanitizer enforces this for structured logs and EMF fields:

- Redacted keys: `authorization`, `cookie`, `token`, `api_key`, `rawKey`, `from`, `to`, `cc`, `bcc`, `replyTo`, `subject`, `html`, `text`, `body`, `headers`, `attachments`, and content payload fields.
- Email-address-shaped strings in freeform fields are replaced with deterministic SHA-256 hashes.
- Safe identifiers such as `email_id`, `job_id`, `delivery_id`, SNS/SES message ids, status, and retry counters may be logged.
- CloudWatch metric dimensions must stay low-cardinality; never use email addresses, domains, subjects, message bodies, or arbitrary customer input as dimensions.

## CloudWatch metrics

Metrics are emitted as EMF JSON log records in the `Opensend` namespace by default. Override with `CLOUDWATCH_METRICS_NAMESPACE` when an environment needs a distinct namespace.

| Area | Metrics | Dimensions |
| --- | --- | --- |
| API email accept | `EmailAccept`, `EmailAcceptLatency` | `Service=api`, `Operation=email.accept`, `Outcome=queued|scheduled|failed|unauthorized|invalid` |
| API batch accept | `EmailBatchAccepted`, `EmailBatchAcceptLatency`, `EmailBatchAcceptFailed` | `Service=api`, `Operation=email.batch_accept`, `Outcome=accepted|failed|unauthorized|invalid` |
| Queue publish | `QueuePublish`, `QueuePublishLatency` | `Service=api|ingester|worker`, `Operation=queue.publish`, `JobType`, `Outcome=published|skipped|failed` |
| Queue depth | `QueueDepthVisible`, `QueueDepthInFlight` | `Service=worker`, `Operation=queue.depth` |
| Worker jobs | `WorkerJobLatency`, `WorkerJobProcessed`, `WorkerFailures`, `RetryCount` | `Service=worker`, `Operation=job.process`, `JobType`, `Outcome` |
| Alert aggregates | `SendFailed`, `QueuePublishFailed`, `QueuePublishSkipped`, `WorkerJobFailed`, `SchedulerHeartbeat`, `SchedulerJobFailed` | Low-cardinality alarm dimensions documented below |
| SES send | `SendLatency`, `SendOutcome` | `Service=worker`, `Operation=ses.send`, `Outcome=sent|failed` |
| SES ingest | `SesEventIngested`, `SesEventIngestFailed` | `Service=ingester`, `Operation=ses.ingest`, `EventType`, `Outcome` |

## Production alert setup

Use the committed reconciler to preview and apply the CloudWatch alarm set:

```bash
bun run scripts/create-cloudwatch-alarms.ts \
  --env production \
  --region us-east-1 \
  --sns-topic-arn arn:aws:sns:us-east-1:123456789012:opensend-ops-alerts \
  --dlq-queue-name opensend-production-dlq \
  --scheduler-interval-seconds 60 \
  --ecs-service namuh/opensend-app/1 \
  --ecs-service namuh/opensend-ingester/1 \
  --json
```

The command is dry-run by default. Add `--apply` only after reviewing the plan.
CloudWatch alarm actions target SNS topic ARNs. Email alerts are SNS email
subscriptions and require the recipient to confirm the AWS SNS subscription.
The default single-topic routing is intentional; use SNS fanout, AWS Chatbot, or
an SNS-to-Lambda bridge if your operation needs Discord delivery or severity-based
channel separation.

The reconciler manages alarms with a stable `ManagedBy=opensend-alerting-script`
tag and reports stale managed alarms by reading CloudWatch alarm tags. Deletion
is separately gated behind `--apply --delete-stale-managed-alarms`.

### Alarmable metrics and exact dimensions

CloudWatch EMF custom metrics require an exact namespace/name/dimension match.
Do not create partial-dimension alarms against detailed metrics such as
`SendOutcome`, `QueuePublish`, or `WorkerFailures`; those metrics intentionally
carry detail dimensions like `SesRegion` and `JobType`. OpenSend emits the
following alarm-friendly aggregate metrics in separate EMF calls:

| Alarm metric | Dimensions | Intent |
| --- | --- | --- |
| `SendFailed` | `Service=worker`, `Operation=ses.send` | Any provider send failure or exhausted retry path. |
| `QueuePublishFailed` | `Service=api|ingester|worker`, `Operation=queue.publish` | One alarm per service that publishes SQS jobs. |
| `QueuePublishSkipped` | `Service=api|ingester|worker`, `Operation=queue.publish` | Queue publish skipped because no queue URL is configured; production should set `BACKGROUND_JOBS_REQUIRE_QUEUE=true` and treat this as drift. |
| `WorkerJobFailed` | `Service=worker`, `Operation=job.process` | Thrown worker failures and terminal provider failures. |
| `SchedulerHeartbeat` | `Service=scheduler`, `Operation=scheduler.batch` | Missing scheduler batch heartbeat. Pass `--scheduler-interval-seconds` when production changes `INGESTER_SCHEDULER_INTERVAL_SECONDS`; the alarm period is rounded up to a standard CloudWatch period. |
| `SchedulerJobFailed` | `Service=scheduler`, `Operation=scheduler.job` | Scheduler job non-2xx, timeout, or fetch failure. |
| `SesEventIngestFailed` | `Service=ingester`, `Operation=ses.ingest`, `Outcome=failed` | SES/SNS ingest exceptions. |

Platform alarms are optional because they require deployment-specific dimensions:
SQS DLQ `QueueName`, ECS Container Insights `ClusterName`/`ServiceName`, and ALB
`LoadBalancer`/`TargetGroup`.

See `agent_docs/runbooks/alerts.md` for first-response steps, false-positive
notes from the 2026-06-11 alarm audit, and the stale-alarm workflow.

Send failure rate alerting remains a follow-up until it can be expressed with an
exact-dimension metric-math query and a minimum-volume guard. The default
production closure for this issue is failed-count alerting through `SendFailed`.

## Trace a send from API accept to provider result

1. Send an email with an explicit correlation id:

   ```bash
   curl -i -X POST "$APP_URL/api/emails" \
     -H "Authorization: Bearer $API_KEY" \
     -H "Content-Type: application/json" \
     -H "x-correlation-id: debug-$(date +%s)" \
     -d '{
       "from":"hello@example.com",
       "to":["recipient@example.com"],
       "subject":"Observability probe",
       "html":"<p>probe</p>"
     }'
   ```

2. Copy the response `x-correlation-id`, `traceparent`, and returned email `id`.
3. In CloudWatch Logs Insights, query the app and ingester application log groups:

   ```sql
   fields @timestamp, level, event, service, operation, correlation_id, trace_id, email_id, job_id, job_type, status, reason, duration_ms
   | filter correlation_id = "debug-..." or traceparent = "00-..." or email_id = "..."
   | sort @timestamp asc
   ```

4. Expected event sequence for an immediate send:

   ```text
   api.request.start
   email.accepted
   span.start / queue.publish
   metric.emf QueuePublish
   span.start / worker.email.send
   span.start / ses.send
   span.end / ses.send
   metric.emf SendOutcome + SendLatency
   span.end / worker.email.send
   metric.emf WorkerJobProcessed + WorkerJobLatency
   ses.event.received
   metric.emf SesEventIngested
   span.start / queue.publish (webhook.dispatch, when matching webhooks exist)
   ```

5. If the API accepted the email but no worker send appears:

   - Check `QueuePublish` for `Outcome=published` on the same `correlation_id`.
   - Check `QueueDepthVisible` and `QueueDepthInFlight`.
   - Confirm the ingester has `BACKGROUND_WORKER_POLL=true` and `BACKGROUND_JOBS_QUEUE_URL` set.
   - Tail the ingester log group described in `docs/ingester-deploy.md`.

6. If the worker failed:

   - Query for `event = "email.send.failed"` or `WorkerFailures` with the same `trace_id`.
   - Check `RetryCount`; SQS retries remain visible through receive count and redrive to the configured DLQ.
   - Inspect SES permissions, sender verification, sandbox status, and AWS service errors in the sanitized `error_name` / `error_message` fields.

## Local verification

Local logs go to stdout/stderr as JSON. With no SQS queue configured, queue publishes emit `queue.publish.skipped` and `QueuePublish` with `Outcome=skipped`, which is expected for Docker-friendly development.

Use the unit coverage for regression checks:

```bash
bun run test -- tests/observability.test.ts tests/background-jobs.test.ts tests/api-emails.test.ts tests/queue-worker.test.ts tests/ingester-ses-route.test.ts
```
