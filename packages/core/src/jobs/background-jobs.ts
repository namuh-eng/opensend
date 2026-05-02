import {
  EventBridgeClient,
  PutEventsCommand,
} from "@aws-sdk/client-eventbridge";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import {
  type TelemetryCarrier,
  createTelemetryContext,
  emitCloudWatchMetric,
  finishTelemetrySpan,
  getTelemetryCarrier,
  logTelemetry,
  recordTelemetryError,
  startTelemetrySpan,
} from "../observability/telemetry";

const MAX_SQS_DELAY_SECONDS = 900;
const BACKGROUND_JOB_EVENT_SOURCE = "opensend.background-jobs";

export type BackgroundJobType =
  | "email.send"
  | "scheduled-email.scan"
  | "webhook.dispatch"
  | "webhook-delivery.scan";

export type BackgroundJobSource =
  | "api"
  | "eventbridge"
  | "manual"
  | "retry"
  | "scheduled-scan"
  | "ses-ingest";

interface BaseBackgroundJob {
  id: string;
  type: BackgroundJobType;
  requestedAt: string;
  source: BackgroundJobSource;
  attempt?: number;
  trace?: TelemetryCarrier;
}

export interface EmailSendJob extends BaseBackgroundJob {
  type: "email.send";
  emailId: string;
}

export interface ScheduledEmailScanJob extends BaseBackgroundJob {
  type: "scheduled-email.scan";
  limit?: number;
}

export interface WebhookDispatchJob extends BaseBackgroundJob {
  type: "webhook.dispatch";
  deliveryId: string;
}

export interface WebhookDeliveryScanJob extends BaseBackgroundJob {
  type: "webhook-delivery.scan";
  limit?: number;
}

export type BackgroundJob =
  | EmailSendJob
  | ScheduledEmailScanJob
  | WebhookDispatchJob
  | WebhookDeliveryScanJob;

export type BackgroundJobInput =
  | (Omit<EmailSendJob, "requestedAt"> & { requestedAt?: string })
  | (Omit<ScheduledEmailScanJob, "requestedAt"> & { requestedAt?: string })
  | (Omit<WebhookDispatchJob, "requestedAt"> & { requestedAt?: string })
  | (Omit<WebhookDeliveryScanJob, "requestedAt"> & { requestedAt?: string });

export interface PublishBackgroundJobOptions {
  delaySeconds?: number;
  deduplicationId?: string;
  groupId?: string;
  requireQueue?: boolean;
}

export type PublishBackgroundJobResult =
  | {
      status: "published";
      messageId: string | null;
      eventId: string | null;
    }
  | {
      status: "skipped";
      reason: "queue_url_missing";
    };

let sqsClient: SQSClient | null = null;
let eventBridgeClient: EventBridgeClient | null = null;

function getRegion(): string {
  return process.env.AWS_REGION?.trim() || "us-east-1";
}

function getQueueUrl(): string | null {
  const value = process.env.BACKGROUND_JOBS_QUEUE_URL?.trim();
  return value ? value : null;
}

function getEventBusName(): string | null {
  const value = process.env.BACKGROUND_JOBS_EVENT_BUS_NAME?.trim();
  return value ? value : null;
}

function requiresQueue(options: PublishBackgroundJobOptions): boolean {
  return (
    options.requireQueue === true ||
    process.env.BACKGROUND_JOBS_REQUIRE_QUEUE === "true"
  );
}

function serviceForJobSource(source: BackgroundJobSource): string {
  if (source === "api") return "api";
  if (source === "ses-ingest") return "ingester";
  return "worker";
}

function getSqsClient(): SQSClient {
  if (!sqsClient) {
    sqsClient = new SQSClient({ region: getRegion() });
  }
  return sqsClient;
}

function getEventBridgeClient(): EventBridgeClient {
  if (!eventBridgeClient) {
    eventBridgeClient = new EventBridgeClient({ region: getRegion() });
  }
  return eventBridgeClient;
}

function sanitizeDelaySeconds(value: number | undefined): number | undefined {
  if (value === undefined) return undefined;
  if (!Number.isFinite(value)) return undefined;
  return Math.max(0, Math.min(MAX_SQS_DELAY_SECONDS, Math.floor(value)));
}

function isFifoQueue(queueUrl: string): boolean {
  return queueUrl.endsWith(".fifo");
}

export function createBackgroundJob(job: BackgroundJobInput): BackgroundJob {
  return {
    ...job,
    requestedAt: job.requestedAt ?? new Date().toISOString(),
  } as BackgroundJob;
}

export function isBackgroundJobQueueConfigured(): boolean {
  return getQueueUrl() !== null;
}

export async function publishBackgroundJob(
  job: BackgroundJob,
  options: PublishBackgroundJobOptions = {},
): Promise<PublishBackgroundJobResult> {
  const telemetry = createTelemetryContext({
    service: serviceForJobSource(job.source),
    operation: "background_job.publish",
    carrier: job.trace,
  });
  const publishSpan = startTelemetrySpan(telemetry, {
    operation: "queue.publish",
    attributes: {
      job_id: job.id,
      job_type: job.type,
      job_source: job.source,
    },
  });
  const queueUrl = getQueueUrl();

  if (!queueUrl) {
    if (requiresQueue(options)) {
      const error = new Error(
        "BACKGROUND_JOBS_QUEUE_URL is required to publish jobs",
      );
      recordTelemetryError(
        publishSpan.context,
        "queue.publish.missing_queue",
        error,
        {
          job_id: job.id,
          job_type: job.type,
        },
      );
      emitQueuePublishMetric(publishSpan.context, 0, job, "failed");
      finishTelemetrySpan(publishSpan, { status: "error" });
      throw error;
    }

    logTelemetry("warn", "queue.publish.skipped", publishSpan.context, {
      job_id: job.id,
      job_type: job.type,
      reason: "queue_url_missing",
    });
    emitQueuePublishMetric(publishSpan.context, 0, job, "skipped");
    finishTelemetrySpan(publishSpan, { status: "skipped" });
    return { status: "skipped", reason: "queue_url_missing" };
  }

  try {
    const fifo = isFifoQueue(queueUrl);
    const tracedJob = {
      ...job,
      trace: getTelemetryCarrier(publishSpan.context),
    };
    const message = await getSqsClient().send(
      new SendMessageCommand({
        QueueUrl: queueUrl,
        MessageBody: JSON.stringify(tracedJob),
        DelaySeconds: sanitizeDelaySeconds(options.delaySeconds),
        MessageAttributes: {
          jobId: { DataType: "String", StringValue: job.id },
          jobType: { DataType: "String", StringValue: job.type },
          source: { DataType: "String", StringValue: job.source },
          correlationId: {
            DataType: "String",
            StringValue: publishSpan.context.correlationId,
          },
          traceparent: {
            DataType: "String",
            StringValue: publishSpan.context.traceparent,
          },
        },
        ...(fifo
          ? {
              MessageDeduplicationId: options.deduplicationId ?? job.id,
              MessageGroupId: options.groupId ?? job.type,
            }
          : {}),
      }),
    );

    const eventId = await publishBackgroundJobEvent(
      tracedJob,
      message.MessageId,
      publishSpan.context,
    );
    const durationMs = finishTelemetrySpan(publishSpan, {
      status: "ok",
      attributes: {
        job_id: job.id,
        job_type: job.type,
        message_id: message.MessageId ?? null,
      },
    });
    emitQueuePublishMetric(publishSpan.context, durationMs, job, "published");

    return {
      status: "published",
      messageId: message.MessageId ?? null,
      eventId,
    };
  } catch (error) {
    recordTelemetryError(publishSpan.context, "queue.publish.failed", error, {
      job_id: job.id,
      job_type: job.type,
    });
    finishTelemetrySpan(publishSpan, { status: "error" });
    emitQueuePublishMetric(publishSpan.context, 0, job, "failed");
    throw error;
  }
}

function emitQueuePublishMetric(
  context: TelemetryCarrier,
  durationMs: number,
  job: BackgroundJob,
  outcome: "published" | "skipped" | "failed",
): void {
  emitCloudWatchMetric(context, {
    metrics: [
      { name: "QueuePublish", value: 1, unit: "Count" },
      {
        name: "QueuePublishLatency",
        value: Math.round(durationMs),
        unit: "Milliseconds",
      },
    ],
    dimensions: {
      Service: serviceForJobSource(job.source),
      Operation: "queue.publish",
      JobType: job.type,
      Outcome: outcome,
    },
  });
}

async function publishBackgroundJobEvent(
  job: BackgroundJob,
  messageId: string | undefined,
  context: TelemetryCarrier,
): Promise<string | null> {
  const eventBusName = getEventBusName();
  if (!eventBusName) return null;

  try {
    const result = await getEventBridgeClient().send(
      new PutEventsCommand({
        Entries: [
          {
            EventBusName: eventBusName,
            Source: BACKGROUND_JOB_EVENT_SOURCE,
            DetailType: job.type,
            Detail: JSON.stringify({ job, messageId }),
          },
        ],
      }),
    );
    return result.Entries?.[0]?.EventId ?? null;
  } catch (error) {
    recordTelemetryError(context, "queue.eventbridge_publish_failed", error, {
      job_id: job.id,
      job_type: job.type,
      message_id: messageId ?? null,
    });
    return null;
  }
}

export function parseBackgroundJob(raw: string): BackgroundJob {
  const parsed = JSON.parse(raw) as unknown;
  if (!isRecord(parsed)) {
    throw new Error("Background job payload must be an object");
  }

  const id = getRequiredString(parsed, "id");
  const type = getRequiredString(parsed, "type") as BackgroundJobType;
  const requestedAt = getRequiredString(parsed, "requestedAt");
  const source = getRequiredString(parsed, "source") as BackgroundJobSource;
  const attempt = getOptionalNumber(parsed, "attempt");

  switch (type) {
    case "email.send":
      return {
        id,
        type,
        requestedAt,
        source,
        ...(attempt !== undefined ? { attempt } : {}),
        ...optionalTrace(parsed),
        emailId: getRequiredString(parsed, "emailId"),
      };
    case "scheduled-email.scan":
      return {
        id,
        type,
        requestedAt,
        source,
        ...(attempt !== undefined ? { attempt } : {}),
        ...optionalTrace(parsed),
        ...optionalLimit(parsed),
      };
    case "webhook.dispatch":
      return {
        id,
        type,
        requestedAt,
        source,
        ...(attempt !== undefined ? { attempt } : {}),
        ...optionalTrace(parsed),
        deliveryId: getRequiredString(parsed, "deliveryId"),
      };
    case "webhook-delivery.scan":
      return {
        id,
        type,
        requestedAt,
        source,
        ...(attempt !== undefined ? { attempt } : {}),
        ...optionalTrace(parsed),
        ...optionalLimit(parsed),
      };
    default:
      throw new Error(`Unsupported background job type: ${type}`);
  }
}

function optionalLimit(value: Record<string, unknown>): { limit?: number } {
  const limit = getOptionalNumber(value, "limit");
  return limit === undefined ? {} : { limit };
}

function optionalTrace(value: Record<string, unknown>): {
  trace?: TelemetryCarrier;
} {
  const trace = value.trace;
  if (!isRecord(trace)) return {};

  const traceparent =
    typeof trace.traceparent === "string" ? trace.traceparent : null;
  const correlationId =
    typeof trace.correlationId === "string" ? trace.correlationId : null;
  if (!traceparent || !correlationId) return {};

  return {
    trace: {
      traceparent,
      correlationId,
      ...(typeof trace.tracestate === "string"
        ? { tracestate: trace.tracestate }
        : {}),
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getRequiredString(
  value: Record<string, unknown>,
  key: string,
): string {
  const field = value[key];
  if (typeof field !== "string" || field.length === 0) {
    throw new Error(`Background job field ${key} must be a non-empty string`);
  }
  return field;
}

function getOptionalNumber(
  value: Record<string, unknown>,
  key: string,
): number | undefined {
  const field = value[key];
  if (field === undefined) return undefined;
  if (typeof field !== "number" || !Number.isFinite(field)) {
    throw new Error(`Background job field ${key} must be a finite number`);
  }
  return field;
}
