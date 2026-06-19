# Observability

Operate OpenSend in production with health checks, structured logs, API request logs, CloudWatch EMF metrics, and committed CloudWatch alarm definitions.

## CloudWatch alert setup

OpenSend includes a dry-run-first alarm reconciler:

```bash
bun run scripts/create-cloudwatch-alarms.ts \
  --env production \
  --region us-east-1 \
  --sns-topic-arn arn:aws:sns:us-east-1:123456789012:opensend-ops-alerts \
  --dlq-queue-name opensend-production-dlq \
  --scheduler-interval-seconds 60 \
  --json
```

Add `--apply` only after reviewing the dry-run output. Alarm actions target SNS
topic ARNs. Email delivery is an SNS email subscription and must be confirmed by
the recipient. The reconciler intentionally uses one SNS topic; use SNS fanout,
AWS Chatbot, or an SNS-to-Lambda bridge for Discord delivery or severity-based
channel separation.

## Alarm families

The reconciler manages failed sends, queue publish failures, worker job failures,
SQS DLQ depth, scheduler heartbeat and job failures, SES ingest failures, and
optional ECS/ALB service-health alarms when exact AWS dimensions are supplied.

CloudWatch EMF alarms require exact dimensions. OpenSend keeps detailed metrics
such as `SendOutcome`, `QueuePublish`, and `WorkerFailures` for drill-down, and
uses alarm-friendly aggregate metrics for alerts:

| Metric | Dimensions |
| --- | --- |
| `SendFailed` | `Service=worker`, `Operation=ses.send` |
| `QueuePublishFailed` | `Service=api|ingester|worker`, `Operation=queue.publish` |
| `QueuePublishSkipped` | `Service=api|ingester|worker`, `Operation=queue.publish` |
| `WorkerJobFailed` | `Service=worker`, `Operation=job.process` |
| `SchedulerHeartbeat` | `Service=scheduler`, `Operation=scheduler.batch` |
| `SchedulerJobFailed` | `Service=scheduler`, `Operation=scheduler.job` |
| `SesEventIngestFailed` | `Service=ingester`, `Operation=ses.ingest`, `Outcome=failed` |

Send failure rate alerting is a follow-up; the default alert is failed-count
alerting through `SendFailed` to avoid low-volume false positives.
