import { generateKeyPairSync, sign } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

type DomainCacheParams = {
  id?: string | null;
  name?: string | null;
  region?: string | null;
};

// Captured at module load by the mocked createDomainService. Tests assert
// the ingester wired `invalidateDomainCaches` into the factory and that the
// real-service contract (one invalidate call per changed row) is honored.
let capturedInvalidator: ((params: DomainCacheParams) => Promise<void>) | null =
  null;

const mockInvalidateDomainCaches = vi
  .fn<(params: DomainCacheParams) => Promise<void>>()
  .mockResolvedValue(undefined);

const mockCreateOrIgnoreDuplicate = vi.fn();
const mockFindEmailById = vi.fn();
const mockCreateInboundEmailIngestionService = vi.fn();
const mockInboundProcess = vi.fn();
const mockDomainReconcileAllPendingVerifications = vi.fn();
const mockEnqueueDomainEvent = vi.fn();
const mockWebhookList = vi.fn();
const mockWebhookListForUserDispatch = vi.fn();
const mockEnqueue = vi.fn();
const mockDispatchDelivery = vi.fn();
const mockPublishBackgroundJob = vi.fn();
const mockEmitCloudWatchMetric = vi.fn();
const mockLogTelemetry = vi.fn();
const mockRecordTelemetryError = vi.fn();
const mockSuppressFromSesEvent = vi.fn();
const mockS3Send = vi.fn();
const SES_EVENTS_TOPIC_ARN = "arn:aws:sns:us-east-1:123456789012:ses-events";
const SES_INBOUND_TOPIC_ARN =
  "arn:aws:sns:us-east-1:123456789012:opensend-inbound-mail";

vi.mock("@aws-sdk/client-s3", () => ({
  GetObjectCommand: class MockGetObjectCommand {
    constructor(readonly input: Record<string, unknown>) {}
  },
  S3Client: class MockS3Client {
    send(command: unknown) {
      return mockS3Send(command);
    }
  },
}));

vi.mock("@opensend/core", () => {
  const testTraceparent =
    "00-11111111111111111111111111111111-2222222222222222-01";
  const getHeader = (
    headers: Record<string, string | undefined> | undefined,
    key: string,
  ): string | null => {
    if (!headers) return null;
    const match = Object.entries(headers).find(
      ([headerKey]) => headerKey.toLowerCase() === key.toLowerCase(),
    );
    return match?.[1] ?? null;
  };

  return {
    createBackgroundJob: (job: Record<string, unknown>) => ({
      ...job,
      requestedAt: "2026-04-28T00:00:00.000Z",
    }),
    createInboundEmailIngestionService: mockCreateInboundEmailIngestionService,
    createTelemetryContext: (input: {
      service: string;
      operation: string;
      headers?: Record<string, string | undefined>;
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
        getHeader(input.headers, "traceparent") ??
        testTraceparent,
      correlationId:
        input.carrier?.correlationId ??
        getHeader(input.headers, "x-correlation-id") ??
        "corr-ingester-test",
    }),
    createDomainService: (deps: {
      invalidateDomainCaches: (params: DomainCacheParams) => Promise<void>;
    }) => {
      // Capture the wired invalidator so tests can verify (a) the ingester
      // DI'd it correctly and (b) the per-row contract is honored.
      capturedInvalidator = deps.invalidateDomainCaches;
      return {
        reconcileAllPendingVerifications: async () => {
          const result =
            await mockDomainReconcileAllPendingVerifications.call(undefined);
          // Simulate the real service: invalidate once per changed row,
          // matching reconcileVerification's contract. This is what proves
          // the factory→invalidator wiring works end-to-end.
          if (
            capturedInvalidator &&
            result &&
            Array.isArray((result as { changes?: unknown[] }).changes)
          ) {
            for (const change of (
              result as {
                changes: Array<{
                  domainId: string;
                  domainName: string;
                  region?: string;
                }>;
              }
            ).changes) {
              await capturedInvalidator({
                id: change.domainId,
                name: change.domainName,
                region: change.region ?? null,
              });
            }
          }
          return result;
        },
      };
    },
    emailEventRepo: {
      createOrIgnoreDuplicate: mockCreateOrIgnoreDuplicate,
    },
    emailRepo: {
      findById: mockFindEmailById,
    },
    emitCloudWatchMetric: mockEmitCloudWatchMetric,
    enqueueDomainEvent: mockEnqueueDomainEvent,
    getSesInboundSnsTopicArns: () => {
      const topics = new Set<string>();
      const configuredMap = process.env.SES_INBOUND_SNS_TOPIC_ARNS?.trim();
      if (configuredMap?.startsWith("{")) {
        const parsed: unknown = JSON.parse(configuredMap);
        if (typeof parsed === "object" && parsed !== null) {
          for (const value of Object.values(parsed)) {
            if (typeof value === "string" && value.trim()) {
              topics.add(value.trim());
            }
          }
        }
      }
      for (const [name, value] of Object.entries(process.env)) {
        if (!name.startsWith("SES_INBOUND_SNS_TOPIC_ARN_")) continue;
        const topicArn = value?.trim();
        if (topicArn) topics.add(topicArn);
      }
      const legacyTopicArn = process.env.SES_INBOUND_SNS_TOPIC_ARN?.trim();
      if (legacyTopicArn) topics.add(legacyTopicArn);
      return [...topics];
    },
    getTelemetryCarrier: (context: {
      traceparent: string;
      correlationId: string;
    }) => ({
      traceparent: context.traceparent,
      correlationId: context.correlationId,
    }),
    logTelemetry: mockLogTelemetry,
    publishBackgroundJob: mockPublishBackgroundJob,
    recordTelemetryError: mockRecordTelemetryError,
    suppressionRepo: {
      suppressFromSesEvent: mockSuppressFromSesEvent,
    },
    timingSafeStringEqual: (a: string, b: string) => a === b,
    toWebhookEventType: (eventType: string) => {
      const candidate = eventType.includes(".")
        ? eventType
        : `email.${eventType}`;
      return [
        "email.sent",
        "email.delivered",
        "email.bounced",
        "email.complained",
        "email.delivery_delayed",
        "email.opened",
        "email.clicked",
        "email.failed",
      ].includes(candidate)
        ? candidate
        : null;
    },
    webhookRepo: {
      listForDispatch: mockWebhookList,
      listForUserDispatch: mockWebhookListForUserDispatch,
    },
  };
});

vi.mock("hono", () => {
  type Handler = (context: {
    req: {
      header: (name: string) => string | undefined;
      json: () => Promise<unknown>;
    };
    json: (data: unknown, status?: number) => Response;
    text: (body: string, status?: number) => Response;
  }) => Response | Promise<Response>;

  class MockHono {
    private routes = new Map<string, Handler>();

    get(path: string, handler: Handler) {
      this.routes.set(`GET ${path}`, handler);
    }

    post(path: string, handler: Handler) {
      this.routes.set(`POST ${path}`, handler);
    }

    async request(input: string, init?: RequestInit) {
      const request = new Request(input, init);
      const url = new URL(request.url);
      const handler = this.routes.get(`${request.method} ${url.pathname}`);

      if (!handler) {
        return new Response("Not Found", { status: 404 });
      }

      return await handler({
        req: {
          header: (name: string) => request.headers.get(name) ?? undefined,
          json: async () => await request.json(),
        },
        json: (data: unknown, status = 200) => Response.json(data, { status }),
        text: (body: string, status = 200) => new Response(body, { status }),
      });
    }
  }

  return {
    Hono: MockHono,
  };
});

vi.mock("../packages/ingester/src/dispatcher", () => ({
  webhookDispatcher: {
    enqueue: mockEnqueue,
    dispatchDelivery: mockDispatchDelivery,
  },
}));

// Mock the ingester cache module to avoid Redis connections in unit tests.
// Use the shared top-level spy so tests can assert per-row invocation.
vi.mock("../packages/ingester/src/cache/domain-cache", () => ({
  invalidateDomainCaches: mockInvalidateDomainCaches,
}));

const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
});
const publicKeyPem = publicKey
  .export({ format: "pem", type: "spki" })
  .toString();

function createSignedEnvelope(options?: {
  messageType?: "Notification" | "SubscriptionConfirmation";
  signatureVersion?: "1" | "2";
  sesMessage?: Record<string, unknown>;
  overrides?: Record<string, string>;
}) {
  const messageType = options?.messageType ?? "Notification";
  const signatureVersion = options?.signatureVersion ?? "2";
  const sesMessage = options?.sesMessage ?? {
    eventType: "Delivery",
    mail: {
      messageId: "ses-msg-1",
      headers: [
        {
          name: "X-Entity-ID",
          value: "550e8400-e29b-41d4-a716-446655440000",
        },
      ],
    },
    delivery: { smtpResponse: "250 ok" },
  };

  const base = {
    Type: messageType,
    MessageId: "sns-msg-1",
    TopicArn: SES_EVENTS_TOPIC_ARN,
    Message:
      messageType === "Notification"
        ? JSON.stringify(sesMessage)
        : "Please confirm your subscription",
    Timestamp: "2026-04-28T00:00:00.000Z",
    SignatureVersion: signatureVersion,
    SigningCertURL:
      "https://sns.us-east-1.amazonaws.com/SimpleNotificationService-test.pem",
    ...(messageType === "Notification"
      ? { Subject: "SES event" }
      : {
          SubscribeURL:
            "https://sns.us-east-1.amazonaws.com/?Action=ConfirmSubscription",
          Token: "token-123",
        }),
    ...options?.overrides,
  };

  const fields =
    messageType === "Notification"
      ? ["Message", "MessageId", "Subject", "Timestamp", "TopicArn", "Type"]
      : [
          "Message",
          "MessageId",
          "SubscribeURL",
          "Timestamp",
          "Token",
          "TopicArn",
          "Type",
        ];
  const stringToSign = `${fields
    .filter((field) => {
      const value = base[field as keyof typeof base];
      return typeof value === "string" && value.length > 0;
    })
    .flatMap((field) => [field, base[field as keyof typeof base] as string])
    .join("\n")}\n`;
  const algorithm = signatureVersion === "1" ? "RSA-SHA1" : "RSA-SHA256";
  const signature = sign(
    algorithm,
    Buffer.from(stringToSign, "utf8"),
    privateKey,
  ).toString("base64");

  return {
    ...base,
    Signature: signature,
  };
}

describe("SES SNS ingestion route", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.stubEnv("SES_EVENTS_SNS_TOPIC_ARN", SES_EVENTS_TOPIC_ARN);

    mockDomainReconcileAllPendingVerifications.mockResolvedValue({
      scanned: 0,
      updated: 0,
      unchanged: 0,
      failed: 0,
      changes: [],
    });
    mockEnqueueDomainEvent.mockResolvedValue({
      eventId: "domain-event-1",
      deliveryIds: [],
    });
    mockEnqueue.mockResolvedValue({ id: "delivery-1" });
    mockDispatchDelivery.mockResolvedValue(undefined);
    mockPublishBackgroundJob.mockResolvedValue({
      status: "skipped",
      reason: "db_polling_fallback_enabled",
    });
    mockWebhookListForUserDispatch.mockResolvedValue({
      data: [
        {
          id: "hook-1",
          userId: "user-1",
          status: "active",
          eventTypes: ["email.delivered"],
        },
      ],
    });
    mockFindEmailById.mockResolvedValue({
      id: "550e8400-e29b-41d4-a716-446655440000",
      userId: "user-1",
    });
    mockEmitCloudWatchMetric.mockReset();
    mockLogTelemetry.mockReset();
    mockRecordTelemetryError.mockReset();
    mockSuppressFromSesEvent.mockResolvedValue([]);
    mockInboundProcess.mockResolvedValue({
      status: "processed",
      provider_event_id: "sns-inbound-msg-1",
      received_email_id: "received-1",
      event_id: "event-1",
      user_id: "user-1",
      attachments: 0,
    });
    mockCreateInboundEmailIngestionService.mockReturnValue({
      process: mockInboundProcess,
    });
    mockS3Send.mockResolvedValue({
      Body: Buffer.from(
        "From: sender@example.test\r\nTo: support@example.test\r\nSubject: SES inbound\r\nContent-Type: text/plain; charset=utf-8\r\n\r\nHello",
      ),
    });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => publicKeyPem,
      }),
    );
  });

  it("runs domain verification reconciliation through the authenticated job endpoint", async () => {
    vi.stubEnv("INGESTER_JOB_TOKEN", "test-job-token");
    mockDomainReconcileAllPendingVerifications.mockResolvedValue({
      scanned: 1,
      updated: 1,
      unchanged: 0,
      failed: 0,
      changes: [
        {
          domainId: "domain-1",
          domainName: "example.com",
          userId: "user-1",
          previousStatus: "pending",
          nextStatus: "verified",
          records: [],
          capabilities: ["sending"],
        },
      ],
    });

    const app = (await import("../packages/ingester/src/index")).default;
    const response = await app.request("http://localhost/jobs/domain-verify", {
      method: "POST",
      headers: { authorization: "Bearer test-job-token" },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      scanned: 1,
      updated: 1,
      unchanged: 0,
      failed: 0,
    });
    expect(mockDomainReconcileAllPendingVerifications).toHaveBeenCalledTimes(1);
    expect(mockEnqueueDomainEvent).toHaveBeenCalledWith({
      type: "domain.updated",
      userId: "user-1",
      payload: {
        id: "domain-1",
        name: "example.com",
        status: "verified",
        previous_status: "pending",
        records: [],
        capabilities: ["sending"],
      },
    });

    // PRD US-013: verify the ingester wired the cache invalidator into the
    // factory AND that the per-row contract is honored.
    expect(capturedInvalidator).toBe(mockInvalidateDomainCaches);
    expect(mockInvalidateDomainCaches).toHaveBeenCalledTimes(1);
    expect(mockInvalidateDomainCaches).toHaveBeenCalledWith({
      id: "domain-1",
      name: "example.com",
      region: null,
    });
  });

  it("invalidates dashboard cache once per updated domain across a multi-row batch", async () => {
    vi.stubEnv("INGESTER_JOB_TOKEN", "test-job-token");
    mockDomainReconcileAllPendingVerifications.mockResolvedValue({
      scanned: 3,
      updated: 2,
      unchanged: 0,
      failed: 0,
      changes: [
        {
          domainId: "domain-a",
          domainName: "alpha.example.com",
          userId: "user-1",
          previousStatus: "pending",
          nextStatus: "verified",
          records: [],
          capabilities: ["sending"],
        },
        {
          domainId: "domain-b",
          domainName: "beta.example.com",
          userId: "user-1",
          previousStatus: "pending",
          nextStatus: "verified",
          records: [],
          capabilities: ["sending"],
        },
      ],
    });

    const app = (await import("../packages/ingester/src/index")).default;
    const response = await app.request("http://localhost/jobs/domain-verify", {
      method: "POST",
      headers: { authorization: "Bearer test-job-token" },
    });

    expect(response.status).toBe(200);

    // Spy must fire exactly once per changed row with the exact contract
    // shape the service uses.
    expect(mockInvalidateDomainCaches).toHaveBeenCalledTimes(2);
    expect(mockInvalidateDomainCaches).toHaveBeenNthCalledWith(1, {
      id: "domain-a",
      name: "alpha.example.com",
      region: null,
    });
    expect(mockInvalidateDomainCaches).toHaveBeenNthCalledWith(2, {
      id: "domain-b",
      name: "beta.example.com",
      region: null,
    });
  });

  it("rejects domain verification job calls without the configured bearer token", async () => {
    vi.stubEnv("INGESTER_JOB_TOKEN", "test-job-token");

    const app = (await import("../packages/ingester/src/index")).default;
    const response = await app.request("http://localhost/jobs/domain-verify", {
      method: "POST",
    });

    expect(response.status).toBe(401);
    expect(await response.text()).toBe("Unauthorized");
    expect(mockDomainReconcileAllPendingVerifications).not.toHaveBeenCalled();
  });

  it("fails closed for production job endpoints when no bearer token is configured", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("INGESTER_JOB_TOKEN", "");

    const app = (await import("../packages/ingester/src/index")).default;
    const response = await app.request("http://localhost/jobs/domain-verify", {
      method: "POST",
    });

    expect(response.status).toBe(401);
    expect(await response.text()).toBe("Unauthorized");
    expect(mockDomainReconcileAllPendingVerifications).not.toHaveBeenCalled();
  });

  it("fails closed for production inbound MIME callbacks when no bearer token is configured", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("INGESTER_INBOUND_TOKEN", "");

    const app = (await import("../packages/ingester/src/index")).default;
    const response = await app.request("http://localhost/events/inbound", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ event_id: "evt-1" }),
    });

    expect(response.status).toBe(401);
    expect(await response.text()).toBe("Unauthorized");
  });

  it("ingests signed SES receipt-rule S3 notifications through the inbound MIME service", async () => {
    vi.stubEnv("SES_INBOUND_BUCKET_NAME", "opensend-inbound-mail");
    const app = (await import("../packages/ingester/src/index")).default;
    const envelope = createSignedEnvelope({
      sesMessage: {
        notificationType: "Received",
        mail: {
          messageId: "ses-inbound-msg-1",
          destination: ["support@example.test"],
          headers: [],
        },
        receipt: {
          recipients: ["support@example.test"],
          action: {
            type: "S3",
            bucketName: "opensend-inbound-mail",
            objectKey: "inbound/example/ses-inbound-msg-1",
          },
        },
      },
    });

    const response = await app.request(
      "http://localhost/events/inbound/ses-s3",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-amz-sns-message-type": "Notification",
        },
        body: JSON.stringify(envelope),
      },
    );

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      status: "processed",
      received_email_id: "received-1",
    });
    expect(mockS3Send).toHaveBeenCalledTimes(1);
    expect(mockS3Send.mock.calls[0]?.[0]).toMatchObject({
      input: {
        Bucket: "opensend-inbound-mail",
        Key: "inbound/example/ses-inbound-msg-1",
      },
    });
    expect(mockInboundProcess).toHaveBeenCalledWith({
      provider: "aws-ses-receiving",
      eventId: "sns-msg-1",
      messageId: "ses-inbound-msg-1",
      recipients: ["support@example.test"],
      rawMimeBase64: Buffer.from(
        "From: sender@example.test\r\nTo: support@example.test\r\nSubject: SES inbound\r\nContent-Type: text/plain; charset=utf-8\r\n\r\nHello",
      ).toString("base64"),
      metadata: {
        sns_message_id: "sns-msg-1",
        sns_topic_arn: "arn:aws:sns:us-east-1:123456789012:ses-events",
        ses_event_type: "Received",
        ses_message_id: "ses-inbound-msg-1",
        s3_bucket: "opensend-inbound-mail",
        s3_key: "inbound/example/ses-inbound-msg-1",
      },
    });
  });

  it("allows SES receipt-rule S3 notifications from a configured region-specific inbound topic", async () => {
    vi.stubEnv("SES_INBOUND_BUCKET_NAME", "opensend-inbound-mail");
    vi.stubEnv(
      "SES_INBOUND_SNS_TOPIC_ARNS",
      JSON.stringify({
        "eu-west-1": "arn:aws:sns:eu-west-1:123456789012:opensend-inbound-mail",
      }),
    );
    const app = (await import("../packages/ingester/src/index")).default;
    const envelope = createSignedEnvelope({
      overrides: {
        TopicArn: "arn:aws:sns:eu-west-1:123456789012:opensend-inbound-mail",
        SigningCertURL:
          "https://sns.eu-west-1.amazonaws.com/SimpleNotificationService-test.pem",
      },
      sesMessage: {
        eventType: "Received",
        mail: {
          messageId: "ses-inbound-msg-region",
          destination: ["support@example.test"],
          headers: [],
        },
        receipt: {
          action: {
            type: "S3",
            bucketName: "opensend-inbound-mail",
            objectKey: "mail/region",
          },
        },
      },
    });

    const response = await app.request(
      "http://localhost/events/inbound/ses-s3",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-amz-sns-message-type": "Notification",
        },
        body: JSON.stringify(envelope),
      },
    );

    expect(response.status).toBe(202);
    expect(mockInboundProcess).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: "sns-msg-1",
        metadata: expect.objectContaining({
          sns_topic_arn:
            "arn:aws:sns:eu-west-1:123456789012:opensend-inbound-mail",
        }),
      }),
    );
  });

  it("rejects SES receipt-rule S3 notifications from an unexpected bucket", async () => {
    vi.stubEnv("SES_INBOUND_BUCKET_NAME", "opensend-inbound-mail");
    const app = (await import("../packages/ingester/src/index")).default;
    const envelope = createSignedEnvelope({
      sesMessage: {
        eventType: "Received",
        mail: {
          messageId: "ses-inbound-msg-2",
          destination: ["support@example.test"],
          headers: [],
        },
        receipt: {
          action: {
            type: "S3",
            bucketName: "attacker-bucket",
            objectKey: "mail",
          },
        },
      },
    });

    const response = await app.request(
      "http://localhost/events/inbound/ses-s3",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-amz-sns-message-type": "Notification",
        },
        body: JSON.stringify(envelope),
      },
    );

    expect(response.status).toBe(400);
    expect(await response.text()).toContain("S3 bucket is not allowed");
    expect(mockS3Send).not.toHaveBeenCalled();
    expect(mockInboundProcess).not.toHaveBeenCalled();
  });

  it("rejects SES receipt-rule S3 notifications from an unexpected inbound SNS topic", async () => {
    vi.stubEnv("SES_INBOUND_BUCKET_NAME", "opensend-inbound-mail");
    vi.stubEnv("SES_INBOUND_SNS_TOPIC_ARN", SES_INBOUND_TOPIC_ARN);
    const app = (await import("../packages/ingester/src/index")).default;
    const envelope = createSignedEnvelope({
      overrides: {
        TopicArn: "arn:aws:sns:us-east-1:123456789012:attacker-topic",
      },
      sesMessage: {
        eventType: "Received",
        mail: {
          messageId: "ses-inbound-msg-3",
          destination: ["support@example.test"],
          headers: [],
        },
        receipt: {
          action: {
            type: "S3",
            bucketName: "opensend-inbound-mail",
            objectKey: "mail",
          },
        },
      },
    });

    const response = await app.request(
      "http://localhost/events/inbound/ses-s3",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-amz-sns-message-type": "Notification",
        },
        body: JSON.stringify(envelope),
      },
    );

    expect(response.status).toBe(403);
    expect(await response.text()).toContain(
      "Inbound SES S3 SNS topic is not allowed",
    );
    expect(mockS3Send).not.toHaveBeenCalled();
    expect(mockInboundProcess).not.toHaveBeenCalled();
  });

  it("rejects the outbound SES events topic on the inbound route once an inbound topic is configured", async () => {
    vi.stubEnv("SES_INBOUND_BUCKET_NAME", "opensend-inbound-mail");
    vi.stubEnv("SES_INBOUND_SNS_TOPIC_ARN", SES_INBOUND_TOPIC_ARN);
    const app = (await import("../packages/ingester/src/index")).default;
    const envelope = createSignedEnvelope({
      sesMessage: {
        eventType: "Received",
        mail: {
          messageId: "ses-inbound-msg-events-topic",
          destination: ["support@example.test"],
          headers: [],
        },
        receipt: {
          action: {
            type: "S3",
            bucketName: "opensend-inbound-mail",
            objectKey: "mail",
          },
        },
      },
    });

    const response = await app.request(
      "http://localhost/events/inbound/ses-s3",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-amz-sns-message-type": "Notification",
        },
        body: JSON.stringify(envelope),
      },
    );

    expect(response.status).toBe(403);
    expect(await response.text()).toContain(
      "Inbound SES S3 SNS topic is not allowed",
    );
    expect(mockS3Send).not.toHaveBeenCalled();
    expect(mockInboundProcess).not.toHaveBeenCalled();
  });

  it("verifies the SNS signature, persists a normalized event, and queues webhook delivery", async () => {
    const persistedEvent = {
      id: "evt-1",
      emailId: "550e8400-e29b-41d4-a716-446655440000",
      sourceId: "sns-msg-1",
      type: "delivered",
      payload: { smtpResponse: "250 ok" },
    };
    mockCreateOrIgnoreDuplicate.mockResolvedValue({
      event: persistedEvent,
      created: true,
    });

    const app = (await import("../packages/ingester/src/index")).default;
    const envelope = createSignedEnvelope();

    const response = await app.request("http://localhost/events/ses", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-amz-sns-message-type": "Notification",
        "x-correlation-id": "corr-ses-test",
        traceparent: "00-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-bbbbbbbbbbbbbbbb-01",
      },
      body: JSON.stringify(envelope),
    });

    expect(response.status).toBe(200);
    expect(mockCreateOrIgnoreDuplicate).toHaveBeenCalledWith({
      emailId: "550e8400-e29b-41d4-a716-446655440000",
      userId: "user-1",
      sourceId: "sns-msg-1",
      type: "delivered",
      payload: { smtpResponse: "250 ok" },
    });
    expect(mockWebhookListForUserDispatch).toHaveBeenCalledWith({
      userId: "user-1",
      eventType: "email.delivered",
      limit: 100,
    });
    expect(mockWebhookList).not.toHaveBeenCalled();
    expect(mockEnqueue).toHaveBeenCalledWith("hook-1", persistedEvent.id);
    expect(mockPublishBackgroundJob).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "webhook.dispatch:delivery-1",
        type: "webhook.dispatch",
        source: "ses-ingest",
        deliveryId: "delivery-1",
        trace: {
          correlationId: "corr-ses-test",
          traceparent:
            "00-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-bbbbbbbbbbbbbbbb-01",
        },
      }),
      expect.objectContaining({
        deduplicationId: "webhook.dispatch:delivery-1",
        groupId: "webhook.dispatch",
      }),
    );
    expect(mockDispatchDelivery).not.toHaveBeenCalled();
  });

  it("queries SES webhook dispatch by event owner before applying the limit", async () => {
    const persistedEvent = {
      id: "evt-owner-hook",
      emailId: "550e8400-e29b-41d4-a716-446655440000",
      sourceId: "sns-msg-1",
      type: "delivered",
      payload: { smtpResponse: "250 ok" },
    };
    mockCreateOrIgnoreDuplicate.mockResolvedValue({
      event: persistedEvent,
      created: true,
    });
    mockWebhookList.mockResolvedValue({
      data: Array.from({ length: 101 }, (_, index) => ({
        id: `hook-other-${index}`,
        userId: "other-user",
        status: "active",
        eventTypes: ["email.delivered"],
      })),
    });
    mockWebhookListForUserDispatch.mockResolvedValue({
      data: [
        {
          id: "hook-owner-after-global-limit",
          userId: "user-1",
          status: "active",
          eventTypes: ["email.delivered"],
        },
      ],
    });

    const app = (await import("../packages/ingester/src/index")).default;
    const envelope = createSignedEnvelope();

    const response = await app.request("http://localhost/events/ses", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-amz-sns-message-type": "Notification",
      },
      body: JSON.stringify(envelope),
    });

    expect(response.status).toBe(200);
    expect(mockWebhookListForUserDispatch).toHaveBeenCalledWith({
      userId: "user-1",
      eventType: "email.delivered",
      limit: 100,
    });
    expect(mockWebhookList).not.toHaveBeenCalled();
    expect(mockEnqueue).toHaveBeenCalledWith(
      "hook-owner-after-global-limit",
      persistedEvent.id,
    );
  });

  it("rejects SES notifications from an unconfigured SNS topic before side effects", async () => {
    const app = (await import("../packages/ingester/src/index")).default;
    const envelope = createSignedEnvelope({
      overrides: {
        TopicArn: "arn:aws:sns:us-east-1:123456789012:attacker-topic",
      },
    });

    const response = await app.request("http://localhost/events/ses", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-amz-sns-message-type": "Notification",
      },
      body: JSON.stringify(envelope),
    });

    expect(response.status).toBe(403);
    expect(await response.text()).toContain("SES SNS topic is not allowed");
    expect(mockFindEmailById).not.toHaveBeenCalled();
    expect(mockCreateOrIgnoreDuplicate).not.toHaveBeenCalled();
    expect(mockSuppressFromSesEvent).not.toHaveBeenCalled();
    expect(mockEnqueue).not.toHaveBeenCalled();
    expect(mockPublishBackgroundJob).not.toHaveBeenCalled();
  });

  it("rejects SES subscription confirmations from an unconfigured SNS topic before confirming", async () => {
    const app = (await import("../packages/ingester/src/index")).default;
    const envelope = createSignedEnvelope({
      messageType: "SubscriptionConfirmation",
      overrides: {
        TopicArn: "arn:aws:sns:us-east-1:123456789012:attacker-topic",
      },
    });

    const response = await app.request("http://localhost/events/ses", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-amz-sns-message-type": "SubscriptionConfirmation",
      },
      body: JSON.stringify(envelope),
    });

    expect(response.status).toBe(403);
    expect(await response.text()).toContain("SES SNS topic is not allowed");
    const fetchedUrls = vi
      .mocked(fetch)
      .mock.calls.map(([input]) =>
        input instanceof Request ? input.url : String(input),
      );
    expect(fetchedUrls).not.toContain(
      "https://sns.us-east-1.amazonaws.com/?Action=ConfirmSubscription",
    );
    expect(mockFindEmailById).not.toHaveBeenCalled();
    expect(mockCreateOrIgnoreDuplicate).not.toHaveBeenCalled();
    expect(mockSuppressFromSesEvent).not.toHaveBeenCalled();
    expect(mockEnqueue).not.toHaveBeenCalled();
    expect(mockPublishBackgroundJob).not.toHaveBeenCalled();
  });

  it("creates user-scoped suppressions for permanent bounce recipients", async () => {
    const persistedEvent = {
      id: "evt-bounce-1",
      emailId: "550e8400-e29b-41d4-a716-446655440000",
      sourceId: "sns-msg-1",
      type: "bounced",
      payload: {
        bounceType: "Permanent",
        bouncedRecipients: [{ emailAddress: "blocked@test.com" }],
      },
    };
    mockCreateOrIgnoreDuplicate.mockResolvedValue({
      event: persistedEvent,
      created: true,
    });
    mockWebhookListForUserDispatch.mockResolvedValue({ data: [] });
    mockSuppressFromSesEvent.mockResolvedValue([{ id: "suppression-1" }]);

    const app = (await import("../packages/ingester/src/index")).default;
    const envelope = createSignedEnvelope({
      sesMessage: {
        eventType: "Bounce",
        mail: {
          messageId: "ses-msg-bounce-1",
          headers: [
            {
              name: "X-Entity-ID",
              value: "550e8400-e29b-41d4-a716-446655440000",
            },
          ],
        },
        bounce: {
          bounceType: "Permanent",
          bouncedRecipients: [{ emailAddress: "blocked@test.com" }],
        },
      },
    });

    const response = await app.request("http://localhost/events/ses", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-amz-sns-message-type": "Notification",
      },
      body: JSON.stringify(envelope),
    });

    expect(response.status).toBe(200);
    expect(mockSuppressFromSesEvent).toHaveBeenCalledWith({
      emailId: "550e8400-e29b-41d4-a716-446655440000",
      recipients: ["blocked@test.com"],
      reason: "bounced",
      sourceEventId: "sns-msg-1",
      sourceMessageId: "ses-msg-bounce-1",
      metadata: { bounceType: "Permanent" },
    });
  });

  it("acks stale SES events for unknown email ids without creating tenantless events", async () => {
    mockFindEmailById.mockResolvedValue(null);

    const app = (await import("../packages/ingester/src/index")).default;
    const envelope = createSignedEnvelope();

    const response = await app.request("http://localhost/events/ses", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-amz-sns-message-type": "Notification",
      },
      body: JSON.stringify(envelope),
    });

    expect(response.status).toBe(200);
    expect(mockCreateOrIgnoreDuplicate).not.toHaveBeenCalled();
    expect(mockEnqueue).not.toHaveBeenCalled();
    expect(mockPublishBackgroundJob).not.toHaveBeenCalled();
    expect(mockLogTelemetry).toHaveBeenCalledWith(
      "warn",
      "ses.event.unknown_email_id",
      expect.any(Object),
      expect.objectContaining({
        email_id: "550e8400-e29b-41d4-a716-446655440000",
      }),
    );
  });

  it("acks SES events for ownerless emails without creating tenantless events", async () => {
    mockFindEmailById.mockResolvedValue({
      id: "550e8400-e29b-41d4-a716-446655440000",
      userId: null,
    });

    const app = (await import("../packages/ingester/src/index")).default;
    const envelope = createSignedEnvelope();

    const response = await app.request("http://localhost/events/ses", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-amz-sns-message-type": "Notification",
      },
      body: JSON.stringify(envelope),
    });

    expect(response.status).toBe(200);
    expect(mockCreateOrIgnoreDuplicate).not.toHaveBeenCalled();
    expect(mockEnqueue).not.toHaveBeenCalled();
    expect(mockPublishBackgroundJob).not.toHaveBeenCalled();
    expect(mockLogTelemetry).toHaveBeenCalledWith(
      "warn",
      "ses.event.email_missing_user_id",
      expect.any(Object),
      expect.objectContaining({
        email_id: "550e8400-e29b-41d4-a716-446655440000",
      }),
    );
  });

  it("does not queue webhooks owned by a different user", async () => {
    mockWebhookListForUserDispatch.mockResolvedValue({
      data: [
        {
          id: "hook-other-user",
          userId: "other-user",
          status: "active",
          eventTypes: ["email.delivered"],
        },
      ],
    });
    mockCreateOrIgnoreDuplicate.mockResolvedValue({
      event: {
        id: "evt-cross-tenant",
        emailId: "550e8400-e29b-41d4-a716-446655440000",
        sourceId: "sns-msg-1",
        type: "delivered",
        payload: { smtpResponse: "250 ok" },
      },
      created: true,
    });

    const app = (await import("../packages/ingester/src/index")).default;
    const envelope = createSignedEnvelope();

    const response = await app.request("http://localhost/events/ses", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-amz-sns-message-type": "Notification",
      },
      body: JSON.stringify(envelope),
    });

    expect(response.status).toBe(200);
    expect(mockCreateOrIgnoreDuplicate).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-1" }),
    );
    expect(mockEnqueue).not.toHaveBeenCalled();
    expect(mockPublishBackgroundJob).not.toHaveBeenCalled();
  });

  it("rejects invalid SNS signatures before touching persistence", async () => {
    const app = (await import("../packages/ingester/src/index")).default;
    const envelope = {
      ...createSignedEnvelope(),
      Signature: "invalid-signature",
    };

    const response = await app.request("http://localhost/events/ses", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-amz-sns-message-type": "Notification",
      },
      body: JSON.stringify(envelope),
    });

    expect(response.status).toBe(401);
    expect(await response.text()).toContain(
      "SNS signature verification failed",
    );
    expect(mockCreateOrIgnoreDuplicate).not.toHaveBeenCalled();
    expect(mockEnqueue).not.toHaveBeenCalled();
    expect(mockDispatchDelivery).not.toHaveBeenCalled();
    expect(mockPublishBackgroundJob).not.toHaveBeenCalled();
  });

  it("acks duplicate SNS notifications without re-dispatching downstream webhooks", async () => {
    mockCreateOrIgnoreDuplicate.mockResolvedValue({
      event: {
        id: "evt-1",
        emailId: "550e8400-e29b-41d4-a716-446655440000",
        sourceId: "sns-msg-1",
        type: "delivered",
        payload: { smtpResponse: "250 ok" },
      },
      created: false,
    });

    const app = (await import("../packages/ingester/src/index")).default;
    const envelope = createSignedEnvelope();

    const response = await app.request("http://localhost/events/ses", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-amz-sns-message-type": "Notification",
      },
      body: JSON.stringify(envelope),
    });

    expect(response.status).toBe(200);
    expect(mockEnqueue).not.toHaveBeenCalled();
    expect(mockDispatchDelivery).not.toHaveBeenCalled();
    expect(mockPublishBackgroundJob).not.toHaveBeenCalled();
    expect(mockWebhookListForUserDispatch).not.toHaveBeenCalled();
  });

  it("rejects malformed SES notifications with a 400", async () => {
    const app = (await import("../packages/ingester/src/index")).default;
    const envelope = createSignedEnvelope({
      sesMessage: {
        mail: {
          headers: [],
        },
      },
    });

    const response = await app.request("http://localhost/events/ses", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-amz-sns-message-type": "Notification",
      },
      body: JSON.stringify(envelope),
    });

    expect(response.status).toBe(400);
    expect(await response.text()).toContain("eventType");
    expect(mockCreateOrIgnoreDuplicate).not.toHaveBeenCalled();
  });
});
