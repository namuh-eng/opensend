import { generateKeyPairSync, sign } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCreateOrIgnoreDuplicate = vi.fn();
const mockDomainReconcileAllPendingVerifications = vi.fn();
const mockEnqueueDomainEvent = vi.fn();
const mockWebhookList = vi.fn();
const mockEnqueue = vi.fn();
const mockDispatchDelivery = vi.fn();
const mockPublishBackgroundJob = vi.fn();
const mockEmitCloudWatchMetric = vi.fn();
const mockLogTelemetry = vi.fn();
const mockRecordTelemetryError = vi.fn();
const mockSuppressFromSesEvent = vi.fn();

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
    domainService: {
      reconcileAllPendingVerifications:
        mockDomainReconcileAllPendingVerifications,
    },
    emailEventRepo: {
      createOrIgnoreDuplicate: mockCreateOrIgnoreDuplicate,
    },
    emitCloudWatchMetric: mockEmitCloudWatchMetric,
    enqueueDomainEvent: mockEnqueueDomainEvent,
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
    TopicArn: "arn:aws:sns:us-east-1:123456789012:ses-events",
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
      reason: "queue_url_missing",
    });
    mockWebhookList.mockResolvedValue({
      data: [
        {
          id: "hook-1",
          status: "active",
          eventTypes: ["email.delivered"],
        },
      ],
    });
    mockEmitCloudWatchMetric.mockReset();
    mockLogTelemetry.mockReset();
    mockRecordTelemetryError.mockReset();
    mockSuppressFromSesEvent.mockResolvedValue([]);

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
      sourceId: "sns-msg-1",
      type: "delivered",
      payload: { smtpResponse: "250 ok" },
    });
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
    mockWebhookList.mockResolvedValue({ data: [] });
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
    expect(mockWebhookList).not.toHaveBeenCalled();
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
