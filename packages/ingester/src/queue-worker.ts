import {
  ChangeMessageVisibilityCommand,
  DeleteMessageCommand,
  GetQueueAttributesCommand,
  ReceiveMessageCommand,
  SQSClient,
} from "@aws-sdk/client-sqs";
import {
  type BackgroundJob,
  type SandboxTestOutcome,
  type TelemetryContext,
  applyEmailTracking,
  createBackgroundJob,
  createEmailTrackingToken,
  createTelemetryContext,
  domainRepo,
  emailEventRepo,
  emailProvider,
  emailRepo,
  emitCloudWatchMetric,
  finishTelemetrySpan,
  getEmailAddressDomain,
  getEmailTrackingBaseUrl,
  getSandboxTestOutcomeForRecipients,
  getTelemetryCarrier,
  logTelemetry,
  parseBackgroundJob,
  publishBackgroundJob,
  recordTelemetryError,
  startTelemetrySpan,
  suppressionRepo,
  toWebhookEventType,
  webhookRepo,
} from "@opensend/core";
import { webhookDispatcher } from "./dispatcher";

const DEFAULT_MAX_MESSAGES = 5;
const DEFAULT_WAIT_TIME_SECONDS = 20;
const DEFAULT_VISIBILITY_TIMEOUT_SECONDS = 60;
const DEFAULT_IDLE_SLEEP_MS = 1_000;
const MAX_SQS_DELAY_SECONDS = 900;
const DEFAULT_PROVIDER_MAX_ATTEMPTS = 3;
const MAX_EMAIL_ATTACHMENT_BASE64_BYTES = 40 * 1024 * 1024;
const MAX_EMAIL_ATTACHMENT_RAW_BYTES = Math.floor(
  (MAX_EMAIL_ATTACHMENT_BASE64_BYTES / 4) * 3,
);
const ATTACHMENT_FETCH_TIMEOUT_MS = 10_000;

type QueueWorkerOptions = {
  queueUrl?: string | null;
  sqsClient?: SQSClient;
  maxMessages?: number;
  waitTimeSeconds?: number;
  visibilityTimeoutSeconds?: number;
  idleSleepMs?: number;
  providerMaxAttempts?: number;
};

type ProcessJobOptions = {
  receiveCount?: number;
  retryDelaySeconds?: number | null;
};

type ProviderErrorSummary = {
  code: string;
  message: string;
};

type StoredAttachment = {
  filename?: unknown;
  content?: unknown;
  path?: unknown;
  content_type?: unknown;
  content_id?: unknown;
};

type ProviderAttachment = {
  filename: string;
  content: string;
  content_type?: string;
  content_id?: string;
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
  private readonly providerMaxAttempts: number;
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
    this.providerMaxAttempts =
      options.providerMaxAttempts ?? getProviderMaxAttempts();
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
        const receiveCount = getReceiveCount(message.Attributes);
        const jobResult = await this.processJob(job, jobSpan.context, {
          receiveCount,
          retryDelaySeconds: getRetryDelaySeconds(message.Attributes),
        });
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
          outcome: isTerminalProviderFailure(jobResult) ? "failed" : "success",
          receiveCount,
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
    options: ProcessJobOptions = {},
  ): Promise<unknown> {
    switch (job.type) {
      case "email.send":
        return await this.processEmailSend(job.emailId, telemetry, options);
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
    options: ProcessJobOptions,
  ): Promise<{
    status: "sent" | "skipped" | "failed";
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
    const terminalSkipReason = getTerminalEmailSkipReason(email.status);
    if (terminalSkipReason) {
      logTelemetry("info", "email.send.skipped", telemetry, {
        reason: terminalSkipReason,
        email_id: email.id,
      });
      return { status: "skipped", reason: terminalSkipReason };
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

    const sandboxOutcome = getSandboxTestOutcomeForRecipients([
      ...email.to,
      ...(email.cc ?? []),
      ...(email.bcc ?? []),
    ]);
    if (sandboxOutcome) {
      return await simulateSandboxTestOutcome({
        email,
        outcome: sandboxOutcome,
        telemetry,
      });
    }

    const sesSpan = startTelemetrySpan(telemetry, {
      operation: "ses.send",
      attributes: { email_id: email.id },
    });
    try {
      // Tracking is intentionally rendered at worker-time: validation, template,
      // and managed-unsubscribe rendering already happened when the email row was
      // accepted, while stored bodies remain unchanged for disabled parity and
      // auditability. The provider payload is the only mutated boundary.
      const trackedHtml = await renderTrackedHtmlForDelivery(email);

      await emailProvider.sendEmail({
        from: email.from,
        to: email.to,
        subject: email.subject,
        html: trackedHtml ?? undefined,
        text: email.text ?? undefined,
        cc: email.cc ?? undefined,
        bcc: email.bcc ?? undefined,
        replyTo: email.replyTo ?? undefined,
        headers: email.headers ?? undefined,
        attachments: await normalizeAttachmentsForSend(email.attachments),
      });
      const sendDurationMs = finishTelemetrySpan(sesSpan, { status: "ok" });

      await emailRepo.update(email.id, {
        status: "sent",
        sentAt: new Date(),
        providerNextRetryAt: null,
        providerDeadLetteredAt: null,
      });
      emitSendMetric(telemetry, {
        durationMs: sendDurationMs,
        outcome: "sent",
      });
      return { status: "sent" };
    } catch (error) {
      finishTelemetrySpan(sesSpan, { status: "error" });
      const attemptCount = Math.max(1, options.receiveCount ?? 1);
      const errorSummary = summarizeProviderError(error);
      const attemptedAt = new Date();
      const retryDelaySeconds = options.retryDelaySeconds ?? null;
      const nextRetryAt =
        retryDelaySeconds === null
          ? null
          : new Date(attemptedAt.getTime() + retryDelaySeconds * 1000);
      const exhausted = attemptCount >= this.providerMaxAttempts;

      await emailRepo.update(email.id, {
        status: exhausted ? "failed" : "queued",
        providerRetryCount: attemptCount,
        providerLastAttemptedAt: attemptedAt,
        providerNextRetryAt: exhausted ? null : nextRetryAt,
        providerLastErrorCode: errorSummary.code,
        providerLastErrorMessage: errorSummary.message,
        providerDeadLetteredAt: exhausted ? attemptedAt : null,
      });

      if (exhausted) {
        await emailEventRepo.create({
          emailId: email.id,
          userId: email.userId,
          sourceId: `provider-dead-letter:${email.id}:${attemptCount}`,
          type: "failed",
          payload: {
            reason: "provider_retries_exhausted",
            provider: "ses",
            attempt_count: attemptCount,
            last_error: errorSummary,
          },
          receivedAt: attemptedAt,
        });
      }

      recordTelemetryError(telemetry, "email.send.failed", error, {
        email_id: email.id,
        provider_attempt_count: attemptCount,
        provider_retries_exhausted: exhausted,
      });
      emitSendMetric(telemetry, {
        durationMs: 0,
        outcome: "failed",
      });

      if (exhausted) {
        return { status: "failed", reason: "provider_retries_exhausted" };
      }

      throw error;
    }
  }
}

async function renderTrackedHtmlForDelivery(
  email: SandboxEmailRecord,
): Promise<string | null | undefined> {
  if (!email.html || !email.userId) return email.html;

  const userId = email.userId;
  const fromDomain = getEmailAddressDomain(email.from);
  if (!fromDomain) return email.html;

  const domain = await domainRepo.findByNameForUser(fromDomain, userId);
  if (!domain || (!domain.trackClicks && !domain.trackOpens)) {
    return email.html;
  }

  const recipient = email.to.length === 1 ? email.to[0] : undefined;
  const trackingBaseUrl = getEmailTrackingBaseUrl({
    trackingSubdomain: domain.trackingSubdomain,
  });

  return applyEmailTracking({
    html: email.html,
    clickTracking: domain.trackClicks,
    openTracking: domain.trackOpens,
    trackingBaseUrl,
    createClickToken: (targetUrl) =>
      createEmailTrackingToken({
        kind: "click",
        userId,
        emailId: email.id,
        domainId: domain.id,
        recipient,
        targetUrl,
      }),
    createOpenToken: () =>
      createEmailTrackingToken({
        kind: "open",
        userId,
        emailId: email.id,
        domainId: domain.id,
        recipient,
      }),
  }).html;
}

function getTerminalEmailSkipReason(status: string): string | null {
  switch (status) {
    case "sent":
      return "already_sent";
    case "delivered":
    case "bounced":
    case "complained":
    case "suppressed":
    case "failed":
      return `already_${status}`;
    default:
      return null;
  }
}

type SandboxEmailRecord = NonNullable<
  Awaited<ReturnType<typeof emailRepo.findById>>
>;

async function simulateSandboxTestOutcome(input: {
  email: SandboxEmailRecord;
  outcome: SandboxTestOutcome;
  telemetry: TelemetryContext;
}): Promise<{ status: "sent" | "skipped"; reason?: string }> {
  const simulatedAt = new Date();
  const sandboxSpan = startTelemetrySpan(input.telemetry, {
    operation: "sandbox.send",
    attributes: {
      email_id: input.email.id,
      sandbox_outcome: input.outcome,
    },
  });

  try {
    switch (input.outcome) {
      case "delivered": {
        await emailRepo.update(input.email.id, {
          status: "sent",
          sentAt: simulatedAt,
          providerNextRetryAt: null,
          providerDeadLetteredAt: null,
        });
        await createSandboxEvent(
          input.email,
          "sent",
          {
            sandbox: true,
            provider: "opensend-sandbox",
            recipients: input.email.to,
          },
          simulatedAt,
          input.telemetry,
        );
        await createSandboxEvent(
          input.email,
          "delivered",
          {
            sandbox: true,
            provider: "opensend-sandbox",
            delivery: {
              recipients: input.email.to,
              timestamp: simulatedAt.toISOString(),
            },
          },
          simulatedAt,
          input.telemetry,
        );
        break;
      }
      case "bounced": {
        await emailRepo.update(input.email.id, {
          status: "sent",
          sentAt: simulatedAt,
          providerNextRetryAt: null,
          providerDeadLetteredAt: null,
        });
        await createSandboxEvent(
          input.email,
          "bounced",
          {
            sandbox: true,
            provider: "opensend-sandbox",
            bounceType: "Permanent",
            bouncedRecipients: input.email.to.map((recipient) => ({
              emailAddress: recipient,
              diagnosticCode: "smtp; 550 5.1.1 (Unknown User)",
              status: "5.1.1",
            })),
          },
          simulatedAt,
          input.telemetry,
        );
        await suppressSandboxRecipients(input.email, "bounced", simulatedAt);
        break;
      }
      case "complained": {
        await emailRepo.update(input.email.id, {
          status: "sent",
          sentAt: simulatedAt,
          providerNextRetryAt: null,
          providerDeadLetteredAt: null,
        });
        await createSandboxEvent(
          input.email,
          "complained",
          {
            sandbox: true,
            provider: "opensend-sandbox",
            complainedRecipients: input.email.to.map((recipient) => ({
              emailAddress: recipient,
            })),
          },
          simulatedAt,
          input.telemetry,
        );
        await suppressSandboxRecipients(input.email, "complained", simulatedAt);
        break;
      }
      case "suppressed": {
        await emailRepo.update(input.email.id, { status: "suppressed" });
        await createSandboxEvent(
          input.email,
          "suppressed",
          {
            sandbox: true,
            provider: "opensend-sandbox",
            recipients: input.email.to,
            reason: "recipient_suppressed",
          },
          simulatedAt,
          input.telemetry,
        );
        break;
      }
    }

    finishTelemetrySpan(sandboxSpan, { status: "ok" });
    emitSendMetric(input.telemetry, { durationMs: 0, outcome: "sent" });
    return { status: "sent" };
  } catch (error) {
    finishTelemetrySpan(sandboxSpan, { status: "error" });
    throw error;
  }
}

async function createSandboxEvent(
  email: SandboxEmailRecord,
  type: string,
  payload: Record<string, unknown>,
  receivedAt: Date,
  telemetry: TelemetryContext,
): Promise<void> {
  const event = await emailEventRepo.create({
    emailId: email.id,
    userId: email.userId,
    sourceId: `sandbox:${type}:${email.id}`,
    type,
    payload,
    receivedAt,
  });

  const webhookEventType = toWebhookEventType(type);
  if (!webhookEventType || !email.userId) return;

  const { data: hooks } = await webhookRepo.listForDispatch({ limit: 100 });
  for (const hook of hooks) {
    const types = hook.eventTypes as string[];
    if (
      hook.userId === email.userId &&
      hook.status === "active" &&
      types.includes(webhookEventType)
    ) {
      const delivery = await webhookDispatcher.enqueue(hook.id, event.id);
      await publishBackgroundJob(
        createBackgroundJob({
          id: `webhook.dispatch:${delivery.id}`,
          type: "webhook.dispatch",
          source: "manual",
          deliveryId: delivery.id,
          trace: getTelemetryCarrier(telemetry),
        }),
        {
          deduplicationId: `webhook.dispatch:${delivery.id}`,
          groupId: "webhook.dispatch",
        },
      );
    }
  }
}

async function suppressSandboxRecipients(
  email: SandboxEmailRecord,
  reason: "bounced" | "complained",
  _receivedAt: Date,
): Promise<void> {
  if (!email.userId) return;

  for (const recipient of email.to) {
    await suppressionRepo.suppress({
      userId: email.userId,
      email: recipient,
      reason,
      sourceEventId: `sandbox:${reason}:${email.id}`,
      sourceEmailId: email.id,
      sourceMessageId: `sandbox-${email.id}`,
      metadata: {
        source: "ses",
        sourceEventId: `sandbox:${reason}:${email.id}`,
        sourceEmailId: email.id,
        sourceMessageId: `sandbox-${email.id}`,
      },
    });
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

function getProviderMaxAttempts(): number {
  const value = Number(process.env.EMAIL_PROVIDER_MAX_ATTEMPTS ?? "");
  if (!Number.isFinite(value) || value < 1)
    return DEFAULT_PROVIDER_MAX_ATTEMPTS;
  return Math.floor(value);
}

function isTerminalProviderFailure(result: unknown): boolean {
  return (
    typeof result === "object" &&
    result !== null &&
    "status" in result &&
    result.status === "failed"
  );
}

function getReceiveCount(
  attributes: Record<string, string> | undefined,
): number {
  const receiveCount = Number(attributes?.ApproximateReceiveCount ?? "1");
  if (!Number.isFinite(receiveCount) || receiveCount < 1) return 1;
  return Math.floor(receiveCount);
}

async function normalizeAttachmentsForSend(
  attachments: StoredAttachment[] | null | undefined,
): Promise<ProviderAttachment[] | undefined> {
  if (!attachments) return undefined;

  const sendable: ProviderAttachment[] = [];
  let totalEncodedBytes = 0;

  for (const attachment of attachments) {
    if (typeof attachment.filename !== "string") continue;

    const contentType =
      typeof attachment.content_type === "string"
        ? attachment.content_type
        : undefined;
    const contentId =
      typeof attachment.content_id === "string"
        ? attachment.content_id
        : undefined;
    const metadata = {
      filename: attachment.filename,
      ...(contentType ? { content_type: contentType } : {}),
      ...(contentId ? { content_id: contentId } : {}),
    };

    if (typeof attachment.content === "string") {
      totalEncodedBytes += attachment.content.replace(/\s/g, "").length;
      assertAttachmentSize(totalEncodedBytes);
      sendable.push({ ...metadata, content: attachment.content });
      continue;
    }

    if (typeof attachment.path === "string") {
      const content = await fetchAttachmentContent(attachment.path);
      totalEncodedBytes += getBase64EncodedSize(content.byteLength);
      assertAttachmentSize(totalEncodedBytes);
      sendable.push({
        ...metadata,
        content: Buffer.from(content).toString("base64"),
      });
    }
  }

  return sendable.length > 0 ? sendable : undefined;
}

async function fetchAttachmentContent(path: string): Promise<Uint8Array> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    ATTACHMENT_FETCH_TIMEOUT_MS,
  );

  try {
    const response = await fetch(path, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(
        `Attachment fetch failed for ${path}: ${response.status} ${response.statusText}`,
      );
    }

    const contentLength = response.headers.get("content-length");
    if (
      contentLength &&
      Number.isFinite(Number(contentLength)) &&
      Number(contentLength) > MAX_EMAIL_ATTACHMENT_RAW_BYTES
    ) {
      throw new Error(
        "Attachments exceed 40MB per email after Base64 encoding",
      );
    }

    if (!response.body) {
      const buffer = new Uint8Array(await response.arrayBuffer());
      if (buffer.byteLength > MAX_EMAIL_ATTACHMENT_RAW_BYTES) {
        throw new Error(
          "Attachments exceed 40MB per email after Base64 encoding",
        );
      }
      return buffer;
    }

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;

    while (true) {
      const result = await reader.read();
      if (result.done) break;

      totalBytes += result.value.byteLength;
      if (totalBytes > MAX_EMAIL_ATTACHMENT_RAW_BYTES) {
        throw new Error(
          "Attachments exceed 40MB per email after Base64 encoding",
        );
      }
      chunks.push(result.value);
    }

    const content = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      content.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return content;
  } finally {
    clearTimeout(timeout);
  }
}

function getBase64EncodedSize(byteLength: number): number {
  return Math.ceil(byteLength / 3) * 4;
}

function assertAttachmentSize(encodedBytes: number): void {
  if (encodedBytes > MAX_EMAIL_ATTACHMENT_BASE64_BYTES) {
    throw new Error("Attachments exceed 40MB per email after Base64 encoding");
  }
}

function getRetryDelaySeconds(
  attributes: Record<string, string> | undefined,
): number | null {
  const receiveCount = getReceiveCount(attributes);
  if (receiveCount <= 1) return null;
  return Math.min(MAX_SQS_DELAY_SECONDS, 2 ** Math.min(receiveCount, 6));
}

export const queueWorker = new QueueWorker();

function summarizeProviderError(error: unknown): ProviderErrorSummary {
  if (error instanceof Error) {
    const maybeCode =
      "name" in error && typeof error.name === "string" && error.name
        ? error.name
        : "provider_error";
    return {
      code: maybeCode,
      message: error.message.slice(0, 1_000),
    };
  }

  if (typeof error === "object" && error !== null) {
    const record = error as Record<string, unknown>;
    const code =
      typeof record.code === "string"
        ? record.code
        : typeof record.name === "string"
          ? record.name
          : "provider_error";
    const message =
      typeof record.message === "string"
        ? record.message
        : "Provider send failed.";
    return { code, message: message.slice(0, 1_000) };
  }

  return { code: "provider_error", message: "Provider send failed." };
}
