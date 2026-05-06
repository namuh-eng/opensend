import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFindById = vi.hoisted(() => vi.fn());
const mockFindDueScheduled = vi.hoisted(() => vi.fn());
const mockUpdateEmail = vi.hoisted(() => vi.fn());
const mockCreateEmailEvent = vi.hoisted(() => vi.fn());
const mockSendEmail = vi.hoisted(() => vi.fn());
const mockPublishBackgroundJob = vi.hoisted(() => vi.fn());
const mockDispatchDelivery = vi.hoisted(() => vi.fn());
const mockDispatchPendingDeliveries = vi.hoisted(() => vi.fn());
const mockEmitCloudWatchMetric = vi.hoisted(() => vi.fn());
const mockLogTelemetry = vi.hoisted(() => vi.fn());
const mockRecordTelemetryError = vi.hoisted(() => vi.fn());

vi.mock("@opensend/core", () => ({
  createBackgroundJob: (job: Record<string, unknown>) => ({
    ...job,
    requestedAt: "2026-04-28T00:00:00.000Z",
  }),
  createTelemetryContext: (input: {
    service: string;
    operation: string;
    carrier?: { traceparent?: string; correlationId?: string };
  }) => ({
    service: input.service,
    operation: input.operation,
    traceId: "11111111111111111111111111111111",
    spanId: "2222222222222222",
    parentSpanId: null,
    sampled: true,
    traceparent:
      input.carrier?.traceparent ??
      "00-11111111111111111111111111111111-2222222222222222-01",
    correlationId: input.carrier?.correlationId ?? "corr-worker-test",
  }),
  emailEventRepo: {
    create: mockCreateEmailEvent,
  },
  emailProvider: {
    sendEmail: mockSendEmail,
  },
  emailRepo: {
    findById: mockFindById,
    findDueScheduled: mockFindDueScheduled,
    update: mockUpdateEmail,
  },
  emitCloudWatchMetric: mockEmitCloudWatchMetric,
  finishTelemetrySpan: () => 12,
  getTelemetryCarrier: (context: {
    traceparent: string;
    correlationId: string;
  }) => ({
    traceparent: context.traceparent,
    correlationId: context.correlationId,
  }),
  logTelemetry: mockLogTelemetry,
  parseBackgroundJob: (raw: string) => JSON.parse(raw),
  publishBackgroundJob: mockPublishBackgroundJob,
  recordTelemetryError: mockRecordTelemetryError,
  startTelemetrySpan: (context: {
    service: string;
    operation: string;
    traceparent: string;
    correlationId: string;
  }) => ({
    context,
    startedAt: 0,
  }),
}));

vi.mock("../packages/ingester/src/dispatcher", () => ({
  webhookDispatcher: {
    dispatchDelivery: mockDispatchDelivery,
    dispatchPendingDeliveries: mockDispatchPendingDeliveries,
  },
}));

describe("QueueWorker", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("sends queued email jobs through the worker and marks status transitions", async () => {
    mockFindById.mockResolvedValue({
      id: "email-1",
      from: "sender@example.com",
      to: ["user@example.com"],
      cc: [],
      bcc: [],
      replyTo: [],
      subject: "Hello",
      html: "<p>Hello</p>",
      text: "",
      headers: { "X-Test": "1" },
      attachments: [{ filename: "inline.txt", content: "aGVsbG8=" }],
      status: "queued",
      scheduledAt: null,
    });

    const { QueueWorker } = await import(
      "../packages/ingester/src/queue-worker"
    );
    const worker = new QueueWorker({ queueUrl: null });

    await expect(
      worker.processJob({
        id: "email.send:email-1",
        type: "email.send",
        source: "api",
        requestedAt: "2026-04-28T00:00:00.000Z",
        emailId: "email-1",
      }),
    ).resolves.toEqual({ status: "sent" });

    expect(mockUpdateEmail).toHaveBeenNthCalledWith(1, "email-1", {
      status: "processing",
    });
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "sender@example.com",
        to: ["user@example.com"],
        attachments: [{ filename: "inline.txt", content: "aGVsbG8=" }],
      }),
    );
    expect(mockUpdateEmail).toHaveBeenNthCalledWith(2, "email-1", {
      status: "sent",
      sentAt: expect.any(Date),
      providerNextRetryAt: null,
      providerDeadLetteredAt: null,
    });
  });

  it("persists retry metadata and leaves provider failures queued for SQS retry", async () => {
    mockFindById.mockResolvedValue({
      id: "email-retry",
      from: "sender@example.com",
      to: ["user@example.com"],
      cc: [],
      bcc: [],
      replyTo: [],
      subject: "Hello",
      html: "<p>Hello</p>",
      text: "",
      headers: {},
      attachments: [],
      status: "queued",
      scheduledAt: null,
      userId: "user-1",
    });
    mockSendEmail.mockRejectedValue(
      Object.assign(new Error("SES is throttling sends"), {
        name: "ThrottlingException",
      }),
    );

    const { QueueWorker } = await import(
      "../packages/ingester/src/queue-worker"
    );
    const worker = new QueueWorker({
      queueUrl: null,
      providerMaxAttempts: 3,
    });

    await expect(
      worker.processJob(
        {
          id: "email.send:email-retry",
          type: "email.send",
          source: "api",
          requestedAt: "2026-04-28T00:00:00.000Z",
          emailId: "email-retry",
        },
        undefined,
        { receiveCount: 2, retryDelaySeconds: 4 },
      ),
    ).rejects.toThrow("SES is throttling sends");

    expect(mockUpdateEmail).toHaveBeenNthCalledWith(1, "email-retry", {
      status: "processing",
    });
    expect(mockUpdateEmail).toHaveBeenNthCalledWith(2, "email-retry", {
      status: "queued",
      providerRetryCount: 2,
      providerLastAttemptedAt: expect.any(Date),
      providerNextRetryAt: expect.any(Date),
      providerLastErrorCode: "ThrottlingException",
      providerLastErrorMessage: "SES is throttling sends",
      providerDeadLetteredAt: null,
    });
    expect(mockCreateEmailEvent).not.toHaveBeenCalled();
  });

  it("dead-letters exhausted provider retries and records a failure event", async () => {
    mockFindById.mockResolvedValue({
      id: "email-dead",
      from: "sender@example.com",
      to: ["user@example.com"],
      cc: [],
      bcc: [],
      replyTo: [],
      subject: "Hello",
      html: "<p>Hello</p>",
      text: "",
      headers: {},
      attachments: [],
      status: "queued",
      scheduledAt: null,
      userId: "user-1",
    });
    mockSendEmail.mockRejectedValue(
      Object.assign(new Error("SES endpoint unavailable"), {
        name: "ServiceUnavailableException",
      }),
    );

    const { QueueWorker } = await import(
      "../packages/ingester/src/queue-worker"
    );
    const worker = new QueueWorker({
      queueUrl: null,
      providerMaxAttempts: 3,
    });

    await expect(
      worker.processJob(
        {
          id: "email.send:email-dead",
          type: "email.send",
          source: "api",
          requestedAt: "2026-04-28T00:00:00.000Z",
          emailId: "email-dead",
        },
        undefined,
        { receiveCount: 3, retryDelaySeconds: 8 },
      ),
    ).resolves.toEqual({
      status: "failed",
      reason: "provider_retries_exhausted",
    });

    expect(mockUpdateEmail).toHaveBeenNthCalledWith(2, "email-dead", {
      status: "failed",
      providerRetryCount: 3,
      providerLastAttemptedAt: expect.any(Date),
      providerNextRetryAt: null,
      providerLastErrorCode: "ServiceUnavailableException",
      providerLastErrorMessage: "SES endpoint unavailable",
      providerDeadLetteredAt: expect.any(Date),
    });
    expect(mockCreateEmailEvent).toHaveBeenCalledWith({
      emailId: "email-dead",
      userId: "user-1",
      sourceId: "provider-dead-letter:email-dead:3",
      type: "failed",
      payload: {
        reason: "provider_retries_exhausted",
        provider: "ses",
        attempt_count: 3,
        last_error: {
          code: "ServiceUnavailableException",
          message: "SES endpoint unavailable",
        },
      },
      receivedAt: expect.any(Date),
    });
  });

  it("publishes due scheduled emails and marks published rows queued", async () => {
    mockFindDueScheduled.mockResolvedValue([
      { id: "email-1" },
      { id: "email-2" },
    ]);
    mockPublishBackgroundJob
      .mockResolvedValueOnce({ status: "published", messageId: "m1" })
      .mockResolvedValueOnce({
        status: "skipped",
        reason: "queue_url_missing",
      });

    const { QueueWorker } = await import(
      "../packages/ingester/src/queue-worker"
    );
    const worker = new QueueWorker({ queueUrl: null });

    await expect(worker.processDueScheduledEmails(2)).resolves.toEqual({
      scanned: 2,
      enqueued: 1,
    });

    expect(mockPublishBackgroundJob).toHaveBeenCalledTimes(2);
    expect(mockPublishBackgroundJob).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "email.send:email-1",
        trace: expect.objectContaining({
          correlationId: "corr-worker-test",
          traceparent:
            "00-11111111111111111111111111111111-2222222222222222-01",
        }),
      }),
      expect.any(Object),
    );
    expect(mockUpdateEmail).toHaveBeenCalledWith("email-1", {
      status: "queued",
    });
    expect(mockUpdateEmail).not.toHaveBeenCalledWith("email-2", {
      status: "queued",
    });
  });

  it("routes webhook dispatch jobs to the dispatcher", async () => {
    mockDispatchDelivery.mockResolvedValue({
      id: "delivery-1",
      status: "success",
    });

    const { QueueWorker } = await import(
      "../packages/ingester/src/queue-worker"
    );
    const worker = new QueueWorker({ queueUrl: null });

    await expect(
      worker.processJob({
        id: "webhook.dispatch:delivery-1",
        type: "webhook.dispatch",
        source: "ses-ingest",
        requestedAt: "2026-04-28T00:00:00.000Z",
        deliveryId: "delivery-1",
      }),
    ).resolves.toEqual({ id: "delivery-1", status: "success" });

    expect(mockDispatchDelivery).toHaveBeenCalledWith("delivery-1");
  });
});
