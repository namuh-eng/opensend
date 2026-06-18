import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockFindById = vi.hoisted(() => vi.fn());
const mockFindDueScheduled = vi.hoisted(() => vi.fn());
const mockFindQueuedForDispatch = vi.hoisted(() => vi.fn());
const mockClaimForSending = vi.hoisted(() => vi.fn());
const mockFindDomainByNameForUser = vi.hoisted(() => vi.fn());
const mockUpdateEmail = vi.hoisted(() => vi.fn());
const mockCreateEmailEvent = vi.hoisted(() => vi.fn());
const mockEnqueueEmailWebhookEvent = vi.hoisted(() => vi.fn());
const mockSendEmail = vi.hoisted(() => vi.fn());
const mockPublishBackgroundJob = vi.hoisted(() => vi.fn());
const mockSuppress = vi.hoisted(() => vi.fn());
const mockListWebhooksForDispatch = vi.hoisted(() => vi.fn());
const mockEnqueueWebhookDelivery = vi.hoisted(() => vi.fn());
const mockDispatchDelivery = vi.hoisted(() => vi.fn());
const mockDispatchPendingDeliveries = vi.hoisted(() => vi.fn());
const mockEmitCloudWatchMetric = vi.hoisted(() => vi.fn());
const mockLogTelemetry = vi.hoisted(() => vi.fn());
const mockRecordTelemetryError = vi.hoisted(() => vi.fn());
const mockApplyEmailTracking = vi.hoisted(() => vi.fn());
const mockCreateEmailTrackingToken = vi.hoisted(() => vi.fn());
const mockSafeOutboundFetch = vi.hoisted(() => vi.fn());

vi.mock("@opensend/core", () => ({
  createBackgroundJob: (job: Record<string, unknown>) => ({
    ...job,
    requestedAt: "2026-04-28T00:00:00.000Z",
  }),
  safeOutboundFetch: mockSafeOutboundFetch,
  createEmailTrackingToken: mockCreateEmailTrackingToken,
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
  domainRepo: {
    findByNameForUser: mockFindDomainByNameForUser,
  },
  emailEventRepo: {
    create: mockCreateEmailEvent,
  },
  emailProvider: {
    sendEmail: mockSendEmail,
  },
  enqueueEmailWebhookEvent: mockEnqueueEmailWebhookEvent,
  emailRepo: {
    findById: mockFindById,
    findDueScheduled: mockFindDueScheduled,
    findQueuedForDispatch: mockFindQueuedForDispatch,
    claimForSending: mockClaimForSending,
    update: mockUpdateEmail,
  },
  buildTrackingSubdomainRecordName: (
    domainName: string,
    trackingSubdomain?: string | null,
  ) => {
    if (!trackingSubdomain) return null;
    return trackingSubdomain.includes(".")
      ? trackingSubdomain
      : `${trackingSubdomain}.${domainName}`;
  },
  getEmailAddressDomain: (address: string) =>
    address.split("@").pop()?.replace(">", "").trim().toLowerCase() ?? "",
  getEmailTrackingBaseUrl: (input: { trackingSubdomain?: string | null }) =>
    input.trackingSubdomain
      ? `https://${input.trackingSubdomain}`
      : "http://localhost:3015",
  getSandboxTestOutcomeForRecipients: (recipients: string[]) => {
    const outcomes = recipients.map((recipient) => {
      const [local, domain] = recipient.trim().toLowerCase().split("@");
      if (domain !== "resend.dev") return null;
      const outcome = local?.split("+")[0];
      return outcome === "delivered" ||
        outcome === "bounced" ||
        outcome === "complained" ||
        (outcome === "suppressed" && local === "suppressed")
        ? outcome
        : null;
    });
    return outcomes.every((outcome) => outcome && outcome === outcomes[0])
      ? outcomes[0]
      : null;
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
  applyEmailTracking: mockApplyEmailTracking,
  publishBackgroundJob: mockPublishBackgroundJob,
  recordTelemetryError: mockRecordTelemetryError,
  suppressionRepo: {
    suppress: mockSuppress,
  },
  startTelemetrySpan: (context: {
    service: string;
    operation: string;
    traceparent: string;
    correlationId: string;
  }) => ({
    context,
    startedAt: 0,
  }),
  toWebhookEventType: (eventType: string) =>
    eventType.includes(".") ? eventType : `email.${eventType}`,
  webhookRepo: {
    listForDispatch: mockListWebhooksForDispatch,
  },
}));

vi.mock("../packages/ingester/src/dispatcher", () => ({
  webhookDispatcher: {
    dispatchDelivery: mockDispatchDelivery,
    dispatchPendingDeliveries: mockDispatchPendingDeliveries,
    enqueue: mockEnqueueWebhookDelivery,
  },
}));

describe("QueueWorker", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockListWebhooksForDispatch.mockResolvedValue({ data: [] });
    mockFindDueScheduled.mockResolvedValue([]);
    mockFindQueuedForDispatch.mockResolvedValue([]);
    mockClaimForSending.mockImplementation(async (id: string) => {
      const email = await mockFindById(id);
      if (!email || email.status !== "queued") return [];
      await mockUpdateEmail(id, { status: "processing" });
      return [{ ...email, status: "processing" }];
    });
    mockEnqueueWebhookDelivery.mockResolvedValue({ id: "delivery-1" });
    mockFindDomainByNameForUser.mockResolvedValue(null);
    mockEnqueueEmailWebhookEvent.mockResolvedValue({
      eventId: "event-delayed",
      deliveryIds: ["delivery-delayed"],
    });
    mockApplyEmailTracking.mockImplementation((input: { html: string }) => ({
      html: input.html,
      rewroteLinks: 0,
      insertedOpenPixel: false,
    }));
    mockCreateEmailTrackingToken.mockImplementation(
      (payload: { kind: string; targetUrl?: string }) =>
        payload.targetUrl
          ? `${payload.kind}:${payload.targetUrl}`
          : payload.kind,
    );
    mockSafeOutboundFetch.mockResolvedValue(new Response("remote file"));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
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
        region: "us-east-1",
        emailId: "email-1",
      }),
    );
    expect(mockUpdateEmail).toHaveBeenNthCalledWith(2, "email-1", {
      status: "sent",
      sentAt: expect.any(Date),
      providerNextRetryAt: null,
      providerDeadLetteredAt: null,
    });
  });

  it("routes queued sends through the From domain SES region", async () => {
    mockFindById.mockResolvedValue({
      id: "email-eu",
      from: "Sender <hello@example.com>",
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
    mockFindDomainByNameForUser.mockResolvedValue({
      id: "domain-eu",
      name: "example.com",
      userId: "user-1",
      region: "eu-west-1",
      trackClicks: false,
      trackOpens: false,
      trackingSubdomain: null,
    });

    const { QueueWorker } = await import(
      "../packages/ingester/src/queue-worker"
    );
    const worker = new QueueWorker({ queueUrl: null });

    await expect(
      worker.processJob({
        id: "email.send:email-eu",
        type: "email.send",
        source: "api",
        requestedAt: "2026-04-28T00:00:00.000Z",
        emailId: "email-eu",
      }),
    ).resolves.toEqual({ status: "sent" });

    expect(mockFindDomainByNameForUser).toHaveBeenCalledTimes(1);
    expect(mockFindDomainByNameForUser).toHaveBeenCalledWith(
      "example.com",
      "user-1",
    );
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ region: "eu-west-1" }),
    );
  });

  it("falls back to us-east-1 when no From-domain row exists", async () => {
    mockFindById.mockResolvedValue({
      id: "email-default-region",
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
    mockFindDomainByNameForUser.mockResolvedValue(null);
    mockEnqueueEmailWebhookEvent.mockResolvedValue({
      eventId: "event-delayed",
      deliveryIds: ["delivery-delayed"],
    });

    const { QueueWorker } = await import(
      "../packages/ingester/src/queue-worker"
    );
    const worker = new QueueWorker({ queueUrl: null });

    await expect(
      worker.processJob({
        id: "email.send:email-default-region",
        type: "email.send",
        source: "api",
        requestedAt: "2026-04-28T00:00:00.000Z",
        emailId: "email-default-region",
      }),
    ).resolves.toEqual({ status: "sent" });

    expect(mockFindDomainByNameForUser).toHaveBeenCalledWith(
      "example.com",
      "user-1",
    );
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ region: "us-east-1" }),
    );
  });

  it("applies domain tracking only to the provider payload", async () => {
    mockFindById.mockResolvedValue({
      id: "email-track",
      from: "sender@example.com",
      to: ["user@example.com"],
      cc: [],
      bcc: [],
      replyTo: [],
      subject: "Hello",
      html: '<p><a href="https://example.com">Hello</a></p>',
      text: "",
      headers: {},
      attachments: [],
      status: "queued",
      scheduledAt: null,
      userId: "user-1",
    });
    mockFindDomainByNameForUser.mockResolvedValue({
      id: "domain-1",
      name: "example.com",
      userId: "user-1",
      trackClicks: true,
      trackOpens: true,
      trackingSubdomain: "track.example.com",
    });
    mockApplyEmailTracking.mockReturnValue({
      html: '<p><a href="https://track.example.com/api/track/click/token">Hello</a></p><img data-opensend-open-tracking="true" />',
      rewroteLinks: 1,
      insertedOpenPixel: true,
    });

    const { QueueWorker } = await import(
      "../packages/ingester/src/queue-worker"
    );
    const worker = new QueueWorker({ queueUrl: null });

    await expect(
      worker.processJob({
        id: "email.send:email-track",
        type: "email.send",
        source: "api",
        requestedAt: "2026-04-28T00:00:00.000Z",
        emailId: "email-track",
      }),
    ).resolves.toEqual({ status: "sent" });

    expect(mockFindDomainByNameForUser).toHaveBeenCalledWith(
      "example.com",
      "user-1",
    );
    expect(mockApplyEmailTracking).toHaveBeenCalledWith(
      expect.objectContaining({
        html: '<p><a href="https://example.com">Hello</a></p>',
        clickTracking: true,
        openTracking: true,
        trackingBaseUrl: "https://track.example.com",
      }),
    );
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        html: expect.stringContaining("data-opensend-open-tracking"),
      }),
    );
    expect(mockUpdateEmail).not.toHaveBeenCalledWith(
      "email-track",
      expect.objectContaining({ html: expect.any(String) }),
    );
  });

  it("preserves provider HTML when domain tracking is disabled", async () => {
    const html = '<p><a href="https://example.com">Hello</a></p>';
    mockFindById.mockResolvedValue({
      id: "email-no-track",
      from: "sender@example.com",
      to: ["user@example.com"],
      cc: [],
      bcc: [],
      replyTo: [],
      subject: "Hello",
      html,
      text: "",
      headers: {},
      attachments: [],
      status: "queued",
      scheduledAt: null,
      userId: "user-1",
    });
    mockFindDomainByNameForUser.mockResolvedValue({
      id: "domain-1",
      name: "example.com",
      userId: "user-1",
      trackClicks: false,
      trackOpens: false,
      trackingSubdomain: "track.example.com",
    });

    const { QueueWorker } = await import(
      "../packages/ingester/src/queue-worker"
    );
    const worker = new QueueWorker({ queueUrl: null });

    await expect(
      worker.processJob({
        id: "email.send:email-no-track",
        type: "email.send",
        source: "api",
        requestedAt: "2026-04-28T00:00:00.000Z",
        emailId: "email-no-track",
      }),
    ).resolves.toEqual({ status: "sent" });

    expect(mockApplyEmailTracking).not.toHaveBeenCalled();
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ html }),
    );
  });

  it("validates remote attachment URLs before fetching provider payloads", async () => {
    const unsafeUrl = "http://169.254.169.254/latest/meta-data";
    mockFindById.mockResolvedValue({
      id: "email-unsafe-attachment",
      from: "sender@example.com",
      to: ["user@example.com"],
      cc: [],
      bcc: [],
      replyTo: [],
      subject: "Hello",
      html: "<p>Hello</p>",
      text: "",
      headers: {},
      attachments: [{ filename: "secret.txt", path: unsafeUrl }],
      status: "queued",
      scheduledAt: null,
      userId: "user-1",
    });
    mockSafeOutboundFetch.mockRejectedValueOnce(
      new Error("Unsafe outbound URL"),
    );

    const { QueueWorker } = await import(
      "../packages/ingester/src/queue-worker"
    );
    const worker = new QueueWorker({
      providerMaxAttempts: 1,
      queueUrl: null,
    });

    await expect(
      worker.processJob({
        id: "email.send:email-unsafe-attachment",
        type: "email.send",
        source: "api",
        requestedAt: "2026-04-28T00:00:00.000Z",
        emailId: "email-unsafe-attachment",
      }),
    ).resolves.toEqual({
      status: "failed",
      reason: "provider_retries_exhausted",
    });

    expect(mockSafeOutboundFetch).toHaveBeenCalledWith(
      unsafeUrl,
      {
        redirect: "error",
        signal: expect.any(AbortSignal),
      },
      { context: "dispatch" },
    );
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("simulates delivered resend.dev recipients without calling the provider", async () => {
    mockFindById.mockResolvedValue({
      id: "email-sandbox-delivered",
      from: "Acme <onboarding@resend.dev>",
      to: ["delivered+signup@resend.dev"],
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
    mockCreateEmailEvent.mockResolvedValue({ id: "event-delivered" });
    mockListWebhooksForDispatch.mockResolvedValue({
      data: [
        {
          id: "webhook-1",
          userId: "user-1",
          status: "active",
          eventTypes: ["email.delivered"],
        },
      ],
    });

    const { QueueWorker } = await import(
      "../packages/ingester/src/queue-worker"
    );
    const worker = new QueueWorker({ queueUrl: null });

    await expect(
      worker.processJob({
        id: "email.send:email-sandbox-delivered",
        type: "email.send",
        source: "api",
        requestedAt: "2026-04-28T00:00:00.000Z",
        emailId: "email-sandbox-delivered",
      }),
    ).resolves.toEqual({ status: "sent" });

    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(mockUpdateEmail).toHaveBeenNthCalledWith(
      1,
      "email-sandbox-delivered",
      {
        status: "processing",
      },
    );
    expect(mockUpdateEmail).toHaveBeenNthCalledWith(
      2,
      "email-sandbox-delivered",
      {
        status: "sent",
        sentAt: expect.any(Date),
        providerNextRetryAt: null,
        providerDeadLetteredAt: null,
      },
    );
    expect(mockCreateEmailEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        emailId: "email-sandbox-delivered",
        userId: "user-1",
        sourceId: "sandbox:sent:email-sandbox-delivered",
        type: "sent",
      }),
    );
    expect(mockCreateEmailEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        emailId: "email-sandbox-delivered",
        userId: "user-1",
        sourceId: "sandbox:delivered:email-sandbox-delivered",
        type: "delivered",
      }),
    );
    expect(mockEnqueueWebhookDelivery).toHaveBeenCalledWith(
      "webhook-1",
      "event-delivered",
    );
  });

  it("simulates bounced resend.dev recipients and records hard-bounce suppression evidence", async () => {
    mockFindById.mockResolvedValue({
      id: "email-sandbox-bounced",
      from: "sender@example.com",
      to: ["bounced@resend.dev"],
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

    const { QueueWorker } = await import(
      "../packages/ingester/src/queue-worker"
    );
    const worker = new QueueWorker({ queueUrl: null });

    await expect(
      worker.processJob({
        id: "email.send:email-sandbox-bounced",
        type: "email.send",
        source: "api",
        requestedAt: "2026-04-28T00:00:00.000Z",
        emailId: "email-sandbox-bounced",
      }),
    ).resolves.toEqual({ status: "sent" });

    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(mockCreateEmailEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        emailId: "email-sandbox-bounced",
        sourceId: "sandbox:bounced:email-sandbox-bounced",
        type: "bounced",
        payload: expect.objectContaining({
          bounceType: "Permanent",
          bouncedRecipients: [
            expect.objectContaining({
              emailAddress: "bounced@resend.dev",
              diagnosticCode: "smtp; 550 5.1.1 (Unknown User)",
            }),
          ],
        }),
      }),
    );
    expect(mockSuppress).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        email: "bounced@resend.dev",
        reason: "bounced",
        sourceEmailId: "email-sandbox-bounced",
      }),
    );
  });

  it("simulates complained resend.dev recipients and records complaint suppressions", async () => {
    mockFindById.mockResolvedValue({
      id: "email-sandbox-complained",
      from: "sender@example.com",
      to: ["complained+flow@resend.dev"],
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

    const { QueueWorker } = await import(
      "../packages/ingester/src/queue-worker"
    );
    const worker = new QueueWorker({ queueUrl: null });

    await expect(
      worker.processJob({
        id: "email.send:email-sandbox-complained",
        type: "email.send",
        source: "api",
        requestedAt: "2026-04-28T00:00:00.000Z",
        emailId: "email-sandbox-complained",
      }),
    ).resolves.toEqual({ status: "sent" });

    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(mockCreateEmailEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceId: "sandbox:complained:email-sandbox-complained",
        type: "complained",
        payload: expect.objectContaining({
          complainedRecipients: [
            { emailAddress: "complained+flow@resend.dev" },
          ],
        }),
      }),
    );
    expect(mockSuppress).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "complained+flow@resend.dev",
        reason: "complained",
      }),
    );
  });

  it("resolves URL path attachments and preserves content_type and content_id", async () => {
    mockSafeOutboundFetch.mockResolvedValueOnce(
      new Response("remote file", {
        status: 200,
        headers: { "content-length": "11" },
      }),
    );
    mockFindById.mockResolvedValue({
      id: "email-path",
      from: "sender@example.com",
      to: ["user@example.com"],
      cc: [],
      bcc: [],
      replyTo: [],
      subject: "Hello",
      html: '<img src="cid:remote-logo" />',
      text: "",
      headers: {},
      attachments: [
        {
          filename: "remote-logo.png",
          path: "https://cdn.example.com/remote-logo.png",
          content_type: "image/png",
          content_id: "remote-logo",
        },
      ],
      status: "queued",
      scheduledAt: null,
    });

    const { QueueWorker } = await import(
      "../packages/ingester/src/queue-worker"
    );
    const worker = new QueueWorker({ queueUrl: null });

    await expect(
      worker.processJob({
        id: "email.send:email-path",
        type: "email.send",
        source: "api",
        requestedAt: "2026-04-28T00:00:00.000Z",
        emailId: "email-path",
      }),
    ).resolves.toEqual({ status: "sent" });

    expect(mockSafeOutboundFetch).toHaveBeenCalledWith(
      "https://cdn.example.com/remote-logo.png",
      {
        redirect: "error",
        signal: expect.any(AbortSignal),
      },
      { context: "dispatch" },
    );
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        attachments: [
          {
            filename: "remote-logo.png",
            content: "cmVtb3RlIGZpbGU=",
            content_type: "image/png",
            content_id: "remote-logo",
          },
        ],
      }),
    );
  });

  it("fails queued delivery explicitly when fetched attachments exceed 40MB encoded", async () => {
    mockSafeOutboundFetch.mockResolvedValueOnce(
      new Response("", {
        status: 200,
        headers: { "content-length": String(30 * 1024 * 1024 + 1) },
      }),
    );
    mockFindById.mockResolvedValue({
      id: "email-large-path",
      from: "sender@example.com",
      to: ["user@example.com"],
      cc: [],
      bcc: [],
      replyTo: [],
      subject: "Hello",
      html: "<p>Hello</p>",
      text: "",
      headers: {},
      attachments: [
        {
          filename: "huge.bin",
          path: "https://cdn.example.com/huge.bin",
        },
      ],
      status: "queued",
      scheduledAt: null,
      userId: "user-1",
    });

    const { QueueWorker } = await import(
      "../packages/ingester/src/queue-worker"
    );
    const worker = new QueueWorker({ queueUrl: null });

    await expect(
      worker.processJob(
        {
          id: "email.send:email-large-path",
          type: "email.send",
          source: "api",
          requestedAt: "2026-04-28T00:00:00.000Z",
          emailId: "email-large-path",
        },
        undefined,
        { receiveCount: 1, retryDelaySeconds: null },
      ),
    ).rejects.toThrow("Attachments exceed 40MB");

    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(mockUpdateEmail).toHaveBeenNthCalledWith(2, "email-large-path", {
      status: "queued",
      providerRetryCount: 1,
      providerLastAttemptedAt: expect.any(Date),
      providerNextRetryAt: null,
      providerLastErrorCode: "Error",
      providerLastErrorMessage:
        "Attachments exceed 40MB per email after Base64 encoding",
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
    expect(mockEnqueueEmailWebhookEvent).toHaveBeenCalledWith({
      type: "email.delayed",
      userId: "user-1",
      emailId: "email-retry",
      sourceId: "provider-delayed:email-retry:2",
      payload: {
        email_id: "email-retry",
        reason: "provider_retry_scheduled",
        provider: "ses",
        attempt_count: 2,
        next_retry_at: expect.any(String),
        last_error: {
          code: "ThrottlingException",
          message: "SES is throttling sends",
        },
      },
      receivedAt: expect.any(Date),
    });
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
    expect(mockEnqueueEmailWebhookEvent).not.toHaveBeenCalled();
  });

  it("publishes due scheduled emails through SQS and marks published rows queued", async () => {
    mockFindDueScheduled.mockResolvedValue([
      { id: "email-1" },
      { id: "email-2" },
    ]);
    mockPublishBackgroundJob
      .mockResolvedValueOnce({ status: "published", messageId: "m1" })
      .mockResolvedValueOnce({
        status: "skipped",
        reason: "db_polling_fallback_enabled",
      });

    const { QueueWorker } = await import(
      "../packages/ingester/src/queue-worker"
    );
    const worker = new QueueWorker({ queueUrl: "https://sqs.example/queue" });

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

  it("promotes due scheduled emails to queued in DB-polling mode without SQS", async () => {
    mockFindDueScheduled.mockResolvedValue([
      { id: "email-scheduled-1" },
      { id: "email-scheduled-2" },
    ]);

    const { QueueWorker } = await import(
      "../packages/ingester/src/queue-worker"
    );
    const worker = new QueueWorker({ queueUrl: null });

    await expect(worker.processDueScheduledEmails(2)).resolves.toEqual({
      scanned: 2,
      enqueued: 2,
    });

    expect(mockPublishBackgroundJob).not.toHaveBeenCalled();
    expect(mockUpdateEmail).toHaveBeenCalledWith("email-scheduled-1", {
      status: "queued",
    });
    expect(mockUpdateEmail).toHaveBeenCalledWith("email-scheduled-2", {
      status: "queued",
    });
  });

  it("polls queued database rows in fallback mode and sends through existing worker pipeline", async () => {
    const queuedEmail = {
      id: "email-db-poll",
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
      providerRetryCount: 0,
      providerNextRetryAt: null,
      userId: "user-1",
    };
    mockFindQueuedForDispatch.mockResolvedValue([queuedEmail]);
    mockFindById.mockResolvedValue(queuedEmail);
    mockSendEmail.mockResolvedValue({ id: "ses-db-poll" });

    const { QueueWorker } = await import(
      "../packages/ingester/src/queue-worker"
    );
    const worker = new QueueWorker({ queueUrl: null });

    await expect(worker.pollDatabaseOnce(1)).resolves.toEqual({
      scanned: 1,
      processed: 1,
      errors: 0,
    });

    expect(mockFindDueScheduled).toHaveBeenCalledWith({ limit: 1 });
    expect(mockFindQueuedForDispatch).toHaveBeenCalledWith({ limit: 1 });
    expect(mockClaimForSending).toHaveBeenCalledWith("email-db-poll");
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ emailId: "email-db-poll" }),
    );
    expect(mockUpdateEmail).toHaveBeenCalledWith("email-db-poll", {
      status: "sent",
      sentAt: expect.any(Date),
      providerNextRetryAt: null,
      providerDeadLetteredAt: null,
    });
  });

  it("does not run DB polling when an SQS queue URL is configured", async () => {
    const { QueueWorker } = await import(
      "../packages/ingester/src/queue-worker"
    );
    const worker = new QueueWorker({ queueUrl: "https://sqs.example/queue" });

    await expect(worker.pollDatabaseOnce()).resolves.toEqual({
      scanned: 0,
      processed: 0,
      errors: 0,
    });

    expect(mockFindQueuedForDispatch).not.toHaveBeenCalled();
    expect(mockSendEmail).not.toHaveBeenCalled();
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
