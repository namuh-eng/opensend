import {
  ChangeMessageVisibilityCommand,
  DeleteMessageCommand,
  GetQueueAttributesCommand,
  ReceiveMessageCommand,
  SQSClient,
} from "@aws-sdk/client-sqs";
import {
  type BackgroundJob,
  type TelemetryContext,
  createBackgroundJob,
  createTelemetryContext,
  emailProvider,
  emailRepo,
  emitCloudWatchMetric,
  finishTelemetrySpan,
  getTelemetryCarrier,
  logTelemetry,
  parseBackgroundJob,
  publishBackgroundJob,
  recordTelemetryError,
  startTelemetrySpan,
} from "@opensend/core";
import { webhookDispatcher } from "./dispatcher";

const DEFAULT_MAX_MESSAGES = 5;
const DEFAULT_WAIT_TIME_SECONDS = 20;
const DEFAULT_VISIBILITY_TIMEOUT_SECONDS = 60;
const DEFAULT_IDLE_SLEEP_MS = 1_000;
const MAX_SQS_DELAY_SECONDS = 900;

type QueueWorkerOptions = {
  queueUrl?: string | null;
  sqsClient?: SQSClient;
  maxMessages?: number;
  waitTimeSeconds?: number;
  visibilityTimeoutSeconds?: number;
  idleSleepMs?: number;
};

type StoredAttachment = {
  filename?: unknown;
  content?: unknown;
};

type PollResult = {
  received: number;
  processed: number;
  deleted: number;
  errors: number;
};

function getQueueUrl(): string | null {
  const value = process.env.BACKGROUND_JOBS_QUEUE_URL?.trim();
  return value ? value : null;
}

function getRegion(): string {
  return process.env.AWS_REGION?.trim() || "us-east-1";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class QueueWorker {
  private readonly queueUrl: string | null;
  private readonly sqsClient: SQSClient;
  private readonly maxMessages: number;
  private readonly waitTimeSeconds: number;
  private readonly visibilityTimeoutSeconds: number;
  private readonly idleSleepMs: number;
  private started = false;

  constructor(options: QueueWorkerOptions = {}) {
    this.queueUrl = options.queueUrl ?? getQueueUrl();
    this.sqsClient =
      options.sqsClient ?? new SQSClient({ region: getRegion() });
    this.maxMessages = options.maxMessages ?? DEFAULT_MAX_MESSAGES;
    this.waitTimeSeconds = options.waitTimeSeconds ?? DEFAULT_WAIT_TIME_SECONDS;
    this.visibilityTimeoutSeconds =
      options.visibilityTimeoutSeconds ?? DEFAULT_VISIBILITY_TIMEOUT_SECONDS;
    this.idleSleepMs = options.idleSleepMs ?? DEFAULT_IDLE_SLEEP_MS;
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    this.pollForever().catch((error) => {
      this.started = false;
      const telemetry = createTelemetryContext({
        service: "worker",
        operation: "queue.poll_forever",
      });
      recordTelemetryError(telemetry, "queue.worker.stopped", error);
    });
  }

  async pollForever(signal?: AbortSignal): Promise<void> {
    while (!signal?.aborted) {
      const result = await this.pollOnce();
      if (result.received === 0) {
        await sleep(this.idleSleepMs);
      }
    }
  }

  async pollOnce(): Promise<PollResult> {
    const pollTelemetry = createTelemetryContext({
      service: "worker",
      operation: "queue.poll",
    });

    if (!this.queueUrl) {
      logTelemetry("warn", "queue.poll.skipped", pollTelemetry, {
        reason: "queue_url_missing",
      });
      return { received: 0, processed: 0, deleted: 0, errors: 0 };
    }

    await this.emitQueueDepthMetric(pollTelemetry);

    const response = await this.sqsClient.send(
      new ReceiveMessageCommand({
        QueueUrl: this.queueUrl,
        MaxNumberOfMessages: this.maxMessages,
        WaitTimeSeconds: this.waitTimeSeconds,
        VisibilityTimeout: this.visibilityTimeoutSeconds,
        MessageSystemAttributeNames: ["ApproximateReceiveCount"],
        MessageAttributeNames: ["All"],
      }),
    );

    const messages = response.Messages ?? [];
    const result: PollResult = {
      received: messages.length,
      processed: 0,
      deleted: 0,
      errors: 0,
    };

    for (const message of messages) {
      let failureTelemetry: TelemetryContext = pollTelemetry;
      let failureJobType: string | null = null;
      let jobSpan: ReturnType<typeof startTelemetrySpan> | null = null;

      if (!message.Body || !message.ReceiptHandle) {
        result.errors++;
        continue;
      }

      try {
        const job = parseBackgroundJob(message.Body);
        failureJobType = job.type;
        const jobTelemetry = createTelemetryContext({
          service: "worker",
          operation: `job.${job.type}`,
          carrier: job.trace,
        });
        jobSpan = startTelemetrySpan(jobTelemetry, {
          operation: `worker.${job.type}`,
          attributes: {
            job_id: job.id,
            job_type: job.type,
            receive_count: getReceiveCount(message.Attributes),
          },
        });
        failureTelemetry = jobSpan.context;
        await this.processJob(job, jobSpan.context);
        result.processed++;
        await this.sqsClient.send(
          new DeleteMessageCommand({
            QueueUrl: this.queueUrl,
            ReceiptHandle: message.ReceiptHandle,
          }),
        );
        result.deleted++;
        const durationMs = finishTelemetrySpan(jobSpan, { status: "ok" });
        emitWorkerJobMetric(jobSpan.context, {
          durationMs,
          jobType: job.type,
          outcome: "success",
          receiveCount: getReceiveCount(message.Attributes),
        });
      } catch (error) {
        result.errors++;
        const delaySeconds = getRetryDelaySeconds(message.Attributes);
        const retryCount = getReceiveCount(message.Attributes) - 1;
        if (delaySeconds !== null) {
          await this.sqsClient.send(
            new ChangeMessageVisibilityCommand({
              QueueUrl: this.queueUrl,
              ReceiptHandle: message.ReceiptHandle,
              VisibilityTimeout: delaySeconds,
            }),
          );
        }
        if (jobSpan) finishTelemetrySpan(jobSpan, { status: "error" });
        recordTelemetryError(failureTelemetry, "worker.job.failed", error, {
          retry_count: retryCount,
          retry_delay_seconds: delaySeconds,
        });
        emitCloudWatchMetric(failureTelemetry, {
          metrics: [
            { name: "WorkerFailures", value: 1, unit: "Count" },
            {
              name: "RetryCount",
              value: Math.max(0, retryCount),
              unit: "Count",
            },
          ],
          dimensions: {
            Service: "worker",
            Operation: "job.process",
            ...(failureJobType ? { JobType: failureJobType } : {}),
            Outcome: "failed",
          },
        });
      }
    }

    return result;
  }

  private async emitQueueDepthMetric(
    telemetry: TelemetryContext,
  ): Promise<void> {
    if (!this.queueUrl) return;

    try {
      const response = await this.sqsClient.send(
        new GetQueueAttributesCommand({
          QueueUrl: this.queueUrl,
          AttributeNames: [
            "ApproximateNumberOfMessages",
            "ApproximateNumberOfMessagesNotVisible",
          ],
        }),
      );
      const visible = Number(
        response.Attributes?.ApproximateNumberOfMessages ?? "0",
      );
      const notVisible = Number(
        response.Attributes?.ApproximateNumberOfMessagesNotVisible ?? "0",
      );

      emitCloudWatchMetric(telemetry, {
        metrics: [
          {
            name: "QueueDepthVisible",
            value: Number.isFinite(visible) ? visible : 0,
            unit: "Count",
          },
          {
            name: "QueueDepthInFlight",
            value: Number.isFinite(notVisible) ? notVisible : 0,
            unit: "Count",
          },
        ],
        dimensions: {
          Service: "worker",
          Operation: "queue.depth",
        },
      });
    } catch (error) {
      recordTelemetryError(telemetry, "queue.depth.failed", error);
    }
  }

  async processJob(
    job: BackgroundJob,
    telemetry = createTelemetryContext({
      service: "worker",
      operation: `job.${job.type}`,
      carrier: job.trace,
    }),
  ): Promise<unknown> {
    switch (job.type) {
      case "email.send":
        return await this.processEmailSend(job.emailId, telemetry);
      case "scheduled-email.scan":
        return await this.processDueScheduledEmails(job.limit, telemetry);
      case "webhook.dispatch":
        return await webhookDispatcher.dispatchDelivery(job.deliveryId);
      case "webhook-delivery.scan":
        return await webhookDispatcher.dispatchPendingDeliveries({
          limit: job.limit,
        });
    }
  }

  async processDueScheduledEmails(
    limit = 50,
    telemetry = createTelemetryContext({
      service: "worker",
      operation: "scheduled-email.scan",
    }),
  ): Promise<{
    scanned: number;
    enqueued: number;
  }> {
    const due = await emailRepo.findDueScheduled({ limit });
    let enqueued = 0;

    for (const email of due) {
      const result = await publishBackgroundJob(
        createBackgroundJob({
          id: `email.send:${email.id}`,
          type: "email.send",
          source: "scheduled-scan",
          emailId: email.id,
          trace: getTelemetryCarrier(telemetry),
        }),
        {
          deduplicationId: `email.send:${email.id}`,
          groupId: "email.send",
        },
      );

      if (result.status === "published") {
        await emailRepo.update(email.id, { status: "queued" });
        enqueued++;
      }
    }

    return { scanned: due.length, enqueued };
  }

  private async processEmailSend(
    emailId: string,
    telemetry: TelemetryContext,
  ): Promise<{
    status: "sent" | "skipped";
    reason?: string;
  }> {
    const email = await emailRepo.findById(emailId);
    if (!email) {
      logTelemetry("warn", "email.send.skipped", telemetry, {
        reason: "not_found",
        email_id: emailId,
      });
      return { status: "skipped", reason: "not_found" };
    }
    if (email.status === "sent") {
      logTelemetry("info", "email.send.skipped", telemetry, {
        reason: "already_sent",
        email_id: email.id,
      });
      return { status: "skipped", reason: "already_sent" };
    }
    if (email.status === "cancelled" || email.status === "canceled") {
      logTelemetry("info", "email.send.skipped", telemetry, {
        reason: "cancelled",
        email_id: email.id,
      });
      return { status: "skipped", reason: "cancelled" };
    }
    if (email.scheduledAt && email.scheduledAt > new Date()) {
      logTelemetry("info", "email.send.skipped", telemetry, {
        reason: "scheduled_for_future",
        email_id: email.id,
      });
      return { status: "skipped", reason: "scheduled_for_future" };
    }

    await emailRepo.update(email.id, { status: "processing" });

    const sesSpan = startTelemetrySpan(telemetry, {
      operation: "ses.send",
      attributes: { email_id: email.id },
    });
    try {
      await emailProvider.sendEmail({
        from: email.from,
        to: email.to,
        subject: email.subject,
        html: email.html ?? undefined,
        text: email.text ?? undefined,
        cc: email.cc ?? undefined,
        bcc: email.bcc ?? undefined,
        replyTo: email.replyTo ?? undefined,
        headers: email.headers ?? undefined,
        attachments: normalizeAttachmentsForSend(email.attachments),
      });
      const sendDurationMs = finishTelemetrySpan(sesSpan, { status: "ok" });

      await emailRepo.update(email.id, {
        status: "sent",
        sentAt: new Date(),
      });
      emitSendMetric(telemetry, {
        durationMs: sendDurationMs,
        outcome: "sent",
      });
      return { status: "sent" };
    } catch (error) {
      finishTelemetrySpan(sesSpan, { status: "error" });
      await emailRepo.update(email.id, { status: "queued" });
      recordTelemetryError(telemetry, "email.send.failed", error, {
        email_id: email.id,
      });
      emitSendMetric(telemetry, {
        durationMs: 0,
        outcome: "failed",
      });
      throw error;
    }
  }
}

function emitWorkerJobMetric(
  telemetry: TelemetryContext,
  input: {
    durationMs: number;
    jobType: string;
    outcome: "success" | "failed";
    receiveCount: number;
  },
): void {
  emitCloudWatchMetric(telemetry, {
    metrics: [
      {
        name: "WorkerJobLatency",
        value: Math.round(input.durationMs),
        unit: "Milliseconds",
      },
      { name: "WorkerJobProcessed", value: 1, unit: "Count" },
      {
        name: "RetryCount",
        value: Math.max(0, input.receiveCount - 1),
        unit: "Count",
      },
    ],
    dimensions: {
      Service: "worker",
      Operation: "job.process",
      JobType: input.jobType,
      Outcome: input.outcome,
    },
  });
}

function emitSendMetric(
  telemetry: TelemetryContext,
  input: { durationMs: number; outcome: "sent" | "failed" },
): void {
  emitCloudWatchMetric(telemetry, {
    metrics: [
      {
        name: "SendLatency",
        value: Math.round(input.durationMs),
        unit: "Milliseconds",
      },
      { name: "SendOutcome", value: 1, unit: "Count" },
    ],
    dimensions: {
      Service: "worker",
      Operation: "ses.send",
      Outcome: input.outcome,
    },
  });
}

function getReceiveCount(
  attributes: Record<string, string> | undefined,
): number {
  const receiveCount = Number(attributes?.ApproximateReceiveCount ?? "1");
  if (!Number.isFinite(receiveCount) || receiveCount < 1) return 1;
  return Math.floor(receiveCount);
}

function normalizeAttachmentsForSend(
  attachments: StoredAttachment[] | null | undefined,
): Array<{ filename: string; content: string }> | undefined {
  if (!attachments) return undefined;

  const sendable = attachments.flatMap((attachment) => {
    if (
      typeof attachment.filename === "string" &&
      typeof attachment.content === "string"
    ) {
      return [{ filename: attachment.filename, content: attachment.content }];
    }
    return [];
  });

  return sendable.length > 0 ? sendable : undefined;
}

function getRetryDelaySeconds(
  attributes: Record<string, string> | undefined,
): number | null {
  const receiveCount = getReceiveCount(attributes);
  if (receiveCount <= 1) return null;
  return Math.min(MAX_SQS_DELAY_SECONDS, 2 ** Math.min(receiveCount, 6));
}

export const queueWorker = new QueueWorker();
