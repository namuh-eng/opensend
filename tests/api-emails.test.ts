import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  batchSendEmailResponseSchema,
  publicApiErrorEnvelopeSchema,
  sendEmailResponseSchema,
} from "../packages/core/src/contracts";

// ── Mocks ─────────────────────────────────────────────────────────

const mockSendEmail = vi.hoisted(() => vi.fn());
const mockPublishBackgroundJob = vi.hoisted(() => vi.fn());
const mockValidateApiKey = vi.hoisted(() => vi.fn());
const mockGetApiKeyAuthHeaderError = vi.hoisted(() => vi.fn());
const mockEmitCloudWatchMetric = vi.hoisted(() => vi.fn());
const mockEnqueueEmailWebhookEvent = vi.hoisted(() => vi.fn());
const mockLogTelemetry = vi.hoisted(() => vi.fn());
const mockRecordTelemetryError = vi.hoisted(() => vi.fn());
const mockListSuppressions = vi.hoisted(() => vi.fn());
const mockDeleteSuppression = vi.hoisted(() => vi.fn());
const mockReserveEmailQuota = vi.hoisted(() => vi.fn());
const mockReleaseEmailQuota = vi.hoisted(() => vi.fn());
const mockEmailReadService = vi.hoisted(() => ({
  listEmails: vi.fn(),
  getEmail: vi.fn(),
  deleteEmail: vi.fn(),
}));
const mockEmailDetailService = vi.hoisted(() => ({
  getEmail: vi.fn(),
  updateEmail: vi.fn(),
}));
const mockEmailLifecycleService = vi.hoisted(() => ({
  listAttachments: vi.fn(),
  getAttachment: vi.fn(),
  cancelEmail: vi.fn(),
  listEvents: vi.fn(),
}));
const MockEmailDetailServiceError = vi.hoisted(
  () =>
    class EmailDetailServiceError extends Error {
      constructor(
        readonly code: string,
        message: string,
      ) {
        super(message);
        this.name = "EmailDetailServiceError";
      }
    },
);
const MockEmailReadServiceError = vi.hoisted(
  () =>
    class EmailReadServiceError extends Error {
      constructor(
        readonly code: string,
        message: string,
      ) {
        super(message);
        this.name = "EmailReadServiceError";
      }
    },
);
const MockEmailLifecycleServiceError = vi.hoisted(
  () =>
    class EmailLifecycleServiceError extends Error {
      constructor(
        readonly code: string,
        message: string,
      ) {
        super(message);
        this.name = "EmailLifecycleServiceError";
      }
    },
);
const mockDb = vi.hoisted(() => ({
  insert: vi.fn(),
  select: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  query: vi.fn(),
  transaction: vi.fn(async (callback: (tx: typeof mockDb) => unknown) =>
    callback(mockDb),
  ),
}));

vi.mock("@/lib/ses", () => ({
  sendEmail: mockSendEmail,
}));

vi.mock("@opensend/core", async () => {
  const contracts = await vi.importActual<
    typeof import("../packages/core/src/contracts")
  >("../packages/core/src/contracts");
  const templateRenderer = await vi.importActual<
    typeof import("../packages/core/src/services/template-renderer")
  >("../packages/core/src/services/template-renderer");
  const testTraceparent =
    "00-11111111111111111111111111111111-2222222222222222-01";
  const getHeader = (
    headers: Headers | Record<string, string | undefined> | undefined,
    key: string,
  ): string | null => {
    if (!headers) return null;
    if ("get" in headers && typeof headers.get === "function") {
      return headers.get(key);
    }
    const match = Object.entries(headers).find(
      ([headerKey]) => headerKey.toLowerCase() === key.toLowerCase(),
    );
    return match?.[1] ?? null;
  };

  return {
    ...contracts,
    ...templateRenderer,
    EmailDetailServiceError: MockEmailDetailServiceError,
    EmailReadServiceError: MockEmailReadServiceError,
    EmailLifecycleServiceError: MockEmailLifecycleServiceError,
    createBackgroundJob: (job: Record<string, unknown>) => ({
      ...job,
      requestedAt: "2026-04-28T00:00:00.000Z",
    }),
    createEmailDetailService: () => mockEmailDetailService,
    createEmailLifecycleService: () => mockEmailLifecycleService,
    createEmailReadService: () => mockEmailReadService,
    SuppressionServiceError: class SuppressionServiceError extends Error {
      constructor(
        readonly code: string,
        message: string,
      ) {
        super(message);
        this.name = "SuppressionServiceError";
      }
    },
    createSuppressionService: () => ({
      listSuppressions: mockListSuppressions,
      deleteSuppression: mockDeleteSuppression,
    }),
    detectSandboxTestRecipient: (recipient: string) => {
      const normalized = recipient.trim().toLowerCase();
      const [local, domain] = normalized.split("@");
      if (domain !== "resend.dev") return null;
      const outcome = local?.split("+")[0];
      if (
        outcome === "delivered" ||
        outcome === "bounced" ||
        outcome === "complained" ||
        (outcome === "suppressed" && local === "suppressed")
      ) {
        return { email: normalized, outcome };
      }
      return null;
    },
    getSandboxTestOutcomeForRecipients: (recipients: string[]) => {
      const outcomes = recipients.map((recipient) => {
        const normalized = recipient.trim().toLowerCase();
        const [local, domain] = normalized.split("@");
        if (domain !== "resend.dev") return null;
        const outcome = local?.split("+")[0];
        if (
          outcome === "delivered" ||
          outcome === "bounced" ||
          outcome === "complained" ||
          (outcome === "suppressed" && local === "suppressed")
        ) {
          return outcome;
        }
        return null;
      });
      return outcomes.length > 0 &&
        outcomes.every((outcome) => outcome && outcome === outcomes[0])
        ? outcomes[0]
        : null;
    },
    createTelemetryContext: (input: {
      service: string;
      operation: string;
      headers?: Headers | Record<string, string | undefined>;
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
        "corr-test",
    }),
    emitCloudWatchMetric: mockEmitCloudWatchMetric,
    enqueueEmailWebhookEvent: mockEnqueueEmailWebhookEvent,
    getTelemetryCarrier: (context: {
      traceparent: string;
      correlationId: string;
    }) => ({
      traceparent: context.traceparent,
      correlationId: context.correlationId,
    }),
    logTelemetry: mockLogTelemetry,
    getThreadForOutboundEmail: async () => ({
      thread_id: null,
      match_status: "unmatched",
      original_email_id: null,
      contact_id: null,
      messages: [],
    }),
    prepareOutboundReplyTracking: async () => ({ enabled: false }),
    publishBackgroundJob: mockPublishBackgroundJob,
    recordTelemetryError: mockRecordTelemetryError,
  };
});

vi.mock("@/lib/db", () => ({
  db: mockDb,
}));

vi.mock("@/lib/billing/quota", async () => {
  const actual = await vi.importActual<typeof import("@/lib/billing/quota")>(
    "@/lib/billing/quota",
  );
  return {
    ...actual,
    reserveEmailQuota: mockReserveEmailQuota,
    releaseEmailQuota: mockReleaseEmailQuota,
  };
});

vi.mock("@/lib/api-auth", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/api-auth")>("@/lib/api-auth");
  return {
    validateApiKey: mockValidateApiKey,
    getApiKeyAuthHeaderError: mockGetApiKeyAuthHeaderError,
    publicApiKeyUnauthorizedResponse: actual.publicApiKeyUnauthorizedResponse,
    unauthorizedResponse: actual.unauthorizedResponse,
  };
});

// Mock drizzle-orm operators
vi.mock("drizzle-orm", async () => {
  const actual = await vi.importActual("drizzle-orm");
  return {
    ...actual,
    eq: vi.fn((...args: unknown[]) => ({ op: "eq", args })),
    desc: vi.fn((col: unknown) => ({ op: "desc", col })),
    lt: vi.fn((...args: unknown[]) => ({ op: "lt", args })),
    gt: vi.fn((...args: unknown[]) => ({ op: "gt", args })),
    gte: vi.fn((...args: unknown[]) => ({ op: "gte", args })),
    and: vi.fn((...args: unknown[]) => ({ op: "and", args })),
  };
});

// ── Helpers ───────────────────────────────────────────────────────

const AUTH_RESULT = {
  apiKeyId: "key-uuid",
  permission: "full_access",
  domain: null,
  userId: "user-1",
};

function makeRequest(
  method: string,
  body?: Record<string, unknown> | unknown[],
  headers?: Record<string, string>,
): Request {
  const url = "http://localhost:3015/api/emails";
  const init: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  };
  if (body) {
    init.body = JSON.stringify(body);
  }
  return new Request(url, init);
}

function isLogInsertCall(call: unknown[]): boolean {
  const table = call[0];
  return typeof table === "object" && table !== null && "requestBody" in table;
}

function nonLogInsertCalls(): unknown[][] {
  return mockDb.insert.mock.calls.filter((call) => !isLogInsertCall(call));
}

// ── Auth Middleware Tests ──────────────────────────────────────────

describe("API Key Authentication", () => {
  beforeEach(() => {
    vi.resetModules();
    mockGetApiKeyAuthHeaderError.mockImplementation(
      (authHeader: string | null | undefined) => {
        if (!authHeader) return "missing_api_key";
        const parts = authHeader.split(" ");
        return parts.length === 2 && parts[0] === "Bearer" && parts[1]
          ? null
          : "malformed_api_key";
      },
    );
  });

  it("returns 401 with a machine-readable code when no auth header", async () => {
    mockValidateApiKey.mockResolvedValue(null);
    const { POST } = await import("@/app/api/emails/route");
    const req = makeRequest("POST", {
      from: "a@b.com",
      to: ["c@d.com"],
      subject: "X",
      html: "<p>Y</p>",
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toMatchObject({
      name: "missing_api_key",
      code: "missing_api_key",
      statusCode: 401,
      message: expect.any(String),
    });
  });

  it("returns 401 with a malformed key code for bad Authorization shape", async () => {
    mockValidateApiKey.mockResolvedValue(null);
    const { POST } = await import("@/app/api/emails/route");
    const req = makeRequest(
      "POST",
      {
        from: "a@b.com",
        to: ["c@d.com"],
        subject: "X",
        html: "<p>Y</p>",
      },
      { Authorization: "Basic nope" },
    );
    const res = await POST(req);
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toMatchObject({
      name: "malformed_api_key",
      code: "malformed_api_key",
      statusCode: 401,
    });
  });

  it("returns 401 with an invalid key code for send requests", async () => {
    mockValidateApiKey.mockResolvedValue(null);
    const { POST } = await import("@/app/api/emails/route");
    const req = makeRequest(
      "POST",
      {
        from: "a@b.com",
        to: ["c@d.com"],
        subject: "X",
        html: "<p>Y</p>",
      },
      { Authorization: "Bearer bad_key" },
    );
    const res = await POST(req);
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toMatchObject({
      name: "invalid_api_key",
      code: "invalid_api_key",
      statusCode: 401,
    });
  });
});

// ── POST /api/emails Tests ────────────────────────────────────────

describe("POST /api/emails", () => {
  beforeEach(() => {
    vi.resetModules();
    mockSendEmail.mockReset();
    mockPublishBackgroundJob.mockReset();
    mockEmitCloudWatchMetric.mockReset();
    mockEnqueueEmailWebhookEvent.mockReset();
    mockEnqueueEmailWebhookEvent.mockResolvedValue({
      eventId: "event-1",
      deliveryIds: [],
    });
    mockLogTelemetry.mockReset();
    mockRecordTelemetryError.mockReset();
    mockReserveEmailQuota.mockReset();
    mockReleaseEmailQuota.mockReset();
    mockReleaseEmailQuota.mockResolvedValue(undefined);
    mockReserveEmailQuota.mockResolvedValue({ ok: true, bypassed: true });
    mockGetApiKeyAuthHeaderError.mockReturnValue(null);
    Object.assign(mockDb.query, {
      emails: { findFirst: vi.fn().mockResolvedValue(null) },
      contacts: { findFirst: vi.fn().mockResolvedValue(null) },
      templates: { findFirst: vi.fn().mockResolvedValue(null) },
    });
    mockDb.insert = vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    });
    mockDb.select = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    });
    mockDb.select = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    });
    mockDb.update = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });
    mockDb.transaction.mockImplementation(
      async (callback: (tx: typeof mockDb) => unknown) => callback(mockDb),
    );
    mockPublishBackgroundJob.mockResolvedValue({
      status: "skipped",
      reason: "queue_url_missing",
    });
    mockValidateApiKey.mockResolvedValue(AUTH_RESULT);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("returns 422 with flattened validation details when required fields are missing", async () => {
    const { POST } = await import("@/app/api/emails/route");
    const req = makeRequest(
      "POST",
      { from: "test@domain.com" },
      { Authorization: "Bearer os_test123" },
    );
    const res = await POST(req);
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(publicApiErrorEnvelopeSchema.parse(json)).toEqual({
      name: "validation_error",
      code: "validation_error",
      message: "Validation failed.",
      statusCode: 422,
      details: {
        formErrors: [],
        fieldErrors: {
          to: [expect.any(String)],
          subject: [expect.any(String)],
        },
      },
    });
  });

  it("returns 400 with invalid_json for malformed JSON", async () => {
    const { POST } = await import("@/app/api/emails/route");
    const req = new Request("http://localhost:3015/api/emails", {
      method: "POST",
      headers: {
        Authorization: "Bearer os_test123",
        "Content-Type": "application/json",
      },
      body: "{",
    });

    const res = await POST(req);

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      name: "invalid_json",
      code: "invalid_json",
      message: "Request body must be valid JSON.",
      statusCode: 400,
    });
  });

  it("returns 422 when from is missing", async () => {
    const { POST } = await import("@/app/api/emails/route");
    const req = makeRequest(
      "POST",
      { to: ["user@test.com"], subject: "Test", html: "<p>Hi</p>" },
      { Authorization: "Bearer os_test123" },
    );
    const res = await POST(req);
    expect(res.status).toBe(422);
  });

  it("persists and queues email delivery on valid request", async () => {
    const emailId = "test-email-uuid";
    mockSendEmail.mockResolvedValue({ id: "ses-msg-id" });

    const valuesMock = vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([{ id: emailId }]),
    });
    mockDb.insert = vi.fn().mockReturnValue({ values: valuesMock });

    const { POST } = await import("@/app/api/emails/route");
    const traceparent =
      "00-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-bbbbbbbbbbbbbbbb-01";
    const req = makeRequest(
      "POST",
      {
        from: "sender@domain.com",
        to: ["user@test.com"],
        subject: "Test Email",
        html: "<p>Hello</p>",
      },
      {
        Authorization: "Bearer os_test123",
        "x-correlation-id": "corr-email-test",
        traceparent,
      },
    );
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("x-correlation-id")).toBe("corr-email-test");
    expect(res.headers.get("traceparent")).toBe(traceparent);
    const body = await res.json();
    expect(sendEmailResponseSchema.parse(body)).toEqual({ id: emailId });
    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(valuesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "queued",
      }),
    );
    expect(valuesMock.mock.calls[0][0]).not.toHaveProperty("sentAt");
    expect(valuesMock.mock.calls[1][0]).toMatchObject({
      endpoint: "/api/emails",
      method: "POST",
      status: 200,
      userId: AUTH_RESULT.userId,
      apiKeyId: AUTH_RESULT.apiKeyId,
      requestBody: expect.objectContaining({
        html: "[REDACTED]",
      }),
      responseBody: { id: emailId },
      document: expect.objectContaining({
        emailId,
        apiKeyId: AUTH_RESULT.apiKeyId,
      }),
    });
    expect(mockPublishBackgroundJob).toHaveBeenCalledWith(
      expect.objectContaining({
        id: `email.send:${emailId}`,
        type: "email.send",
        source: "api",
        emailId,
        trace: {
          correlationId: "corr-email-test",
          traceparent,
        },
      }),
      expect.objectContaining({
        deduplicationId: `email.send:${emailId}`,
        groupId: "email.send",
      }),
    );
  });

  it("renders template triple-brace placeholders with fallback values", async () => {
    const emailId = "templated-email-uuid";
    const valuesMock = vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([{ id: emailId }]),
    });
    mockDb.insert = vi.fn().mockReturnValue({ values: valuesMock });
    Object.assign(mockDb.query, {
      emails: { findFirst: vi.fn().mockResolvedValue(null) },
      contacts: { findFirst: vi.fn().mockResolvedValue(null) },
      templates: {
        findFirst: vi.fn().mockResolvedValue({
          id: "11111111-1111-4111-8111-111111111111",
          userId: AUTH_RESULT.userId,
          subject: "Receipt for {{{PRODUCT}}}",
          html: "<p>{{{PRODUCT}}}</p><p>{{ PRICE }}</p>",
          text: "Text {{{PRODUCT}}} {{ PRICE }}",
          variables: [
            {
              name: "PRODUCT",
              key: "PRODUCT",
              type: "string",
              required: false,
              fallbackValue: "item",
            },
            {
              name: "PRICE",
              key: "PRICE",
              type: "number",
              required: false,
              fallbackValue: 25,
            },
          ],
        }),
      },
    });

    const { POST } = await import("@/app/api/emails/route");
    const res = await POST(
      makeRequest(
        "POST",
        {
          from: "sender@domain.com",
          to: ["user@test.com"],
          subject: "Ignored when template has subject",
          template: {
            id: "11111111-1111-4111-8111-111111111111",
            variables: {},
          },
        },
        { Authorization: "Bearer os_test123" },
      ),
    );

    expect(res.status).toBe(200);
    expect(valuesMock.mock.calls[0][0]).toMatchObject({
      subject: "Receipt for item",
      html: "<p>item</p><p>25</p>",
      text: "Text item 25",
      status: "queued",
    });
  });

  it("renders provided template variables over fallbacks across triple and double braces", async () => {
    const valuesMock = vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([{ id: "templated-email-2" }]),
    });
    mockDb.insert = vi.fn().mockReturnValue({ values: valuesMock });
    Object.assign(mockDb.query, {
      emails: { findFirst: vi.fn().mockResolvedValue(null) },
      contacts: { findFirst: vi.fn().mockResolvedValue(null) },
      templates: {
        findFirst: vi.fn().mockResolvedValue({
          id: "11111111-1111-4111-8111-111111111111",
          userId: AUTH_RESULT.userId,
          subject: "Receipt for {{ PRODUCT }}",
          html: "<p>{{{PRODUCT}}}</p><p>{{{PRICE}}}</p>",
          text: null,
          variables: [
            {
              name: "PRODUCT",
              key: "PRODUCT",
              type: "string",
              required: true,
              fallbackValue: null,
            },
            {
              name: "PRICE",
              key: "PRICE",
              type: "number",
              required: false,
              fallbackValue: 25,
            },
          ],
        }),
      },
    });

    const { POST } = await import("@/app/api/emails/route");
    const res = await POST(
      makeRequest(
        "POST",
        {
          from: "sender@domain.com",
          to: ["user@test.com"],
          subject: "Ignored when template has subject",
          template: {
            id: "11111111-1111-4111-8111-111111111111",
            variables: { PRODUCT: "Widget" },
          },
        },
        { Authorization: "Bearer os_test123" },
      ),
    );

    expect(res.status).toBe(200);
    expect(valuesMock.mock.calls[0][0]).toMatchObject({
      subject: "Receipt for Widget",
      html: "<p>Widget</p><p>25</p>",
      text: "",
    });
  });

  it("renders React Email-backed stored templates through the shared renderer", async () => {
    const valuesMock = vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([{ id: "react-template-email" }]),
    });
    mockDb.insert = vi.fn().mockReturnValue({ values: valuesMock });
    Object.assign(mockDb.query, {
      emails: { findFirst: vi.fn().mockResolvedValue(null) },
      contacts: { findFirst: vi.fn().mockResolvedValue(null) },
      templates: {
        findFirst: vi.fn().mockResolvedValue({
          id: "11111111-1111-4111-8111-111111111111",
          userId: AUTH_RESULT.userId,
          subject: null,
          html: "<p>legacy html should not render</p>",
          text: "legacy text should not render",
          variables: [],
          document: {
            rendering: {
              kind: "react_email",
              templateKey: "demo-welcome",
            },
          },
        }),
      },
    });

    const { POST } = await import("@/app/api/emails/route");
    const res = await POST(
      makeRequest(
        "POST",
        {
          from: "sender@domain.com",
          to: ["user@test.com"],
          subject: "Ignored for React registry templates",
          template: {
            id: "11111111-1111-4111-8111-111111111111",
            variables: {
              recipientName: "Ada",
              productName: "Acme",
              actionUrl: "https://example.com/start",
            },
          },
        },
        { Authorization: "Bearer os_test123" },
      ),
    );

    expect(res.status).toBe(200);
    const inserted = valuesMock.mock.calls[0][0];
    expect(inserted).toMatchObject({
      subject: "Welcome to Acme",
      text: expect.stringContaining("Hi Ada"),
      status: "queued",
    });
    expect(inserted.html).toContain("Welcome to Acme");
    expect(inserted.html).toContain("https://example.com/start");
  });

  it("returns a public validation error for unknown React Email template keys", async () => {
    Object.assign(mockDb.query, {
      emails: { findFirst: vi.fn().mockResolvedValue(null) },
      contacts: { findFirst: vi.fn().mockResolvedValue(null) },
      templates: {
        findFirst: vi.fn().mockResolvedValue({
          id: "11111111-1111-4111-8111-111111111111",
          userId: AUTH_RESULT.userId,
          subject: null,
          html: null,
          text: null,
          variables: [],
          document: {
            rendering: {
              kind: "react_email",
              templateKey: "tenant-provided-tsx-string",
            },
          },
        }),
      },
    });

    const { POST } = await import("@/app/api/emails/route");
    const res = await POST(
      makeRequest(
        "POST",
        {
          from: "sender@domain.com",
          to: ["user@test.com"],
          subject: "Will not render",
          template: {
            id: "11111111-1111-4111-8111-111111111111",
            variables: {},
          },
        },
        { Authorization: "Bearer os_test123" },
      ),
    );

    expect(res.status).toBe(422);
    await expect(res.json()).resolves.toMatchObject({
      name: "validation_error",
      code: "validation_error",
      statusCode: 422,
      message: "Unknown React Email template key: tenant-provided-tsx-string",
      details: {
        fieldErrors: {
          template: [
            "Unknown React Email template key: tenant-provided-tsx-string",
          ],
        },
      },
    });
    expect(mockReserveEmailQuota).not.toHaveBeenCalled();
    expect(nonLogInsertCalls()).toHaveLength(0);
  });

  it("keeps the public validation_error envelope for missing template variables without fallbacks", async () => {
    Object.assign(mockDb.query, {
      emails: { findFirst: vi.fn().mockResolvedValue(null) },
      contacts: { findFirst: vi.fn().mockResolvedValue(null) },
      templates: {
        findFirst: vi.fn().mockResolvedValue({
          id: "11111111-1111-4111-8111-111111111111",
          userId: AUTH_RESULT.userId,
          subject: "Receipt for {{{PRODUCT}}}",
          html: "<p>{{{PRODUCT}}}</p>",
          text: null,
          variables: [
            {
              name: "PRODUCT",
              key: "PRODUCT",
              type: "string",
              required: true,
              fallbackValue: null,
            },
          ],
        }),
      },
    });

    const { POST } = await import("@/app/api/emails/route");
    const res = await POST(
      makeRequest(
        "POST",
        {
          from: "sender@domain.com",
          to: ["user@test.com"],
          subject: "Ignored when template has subject",
          template: {
            id: "11111111-1111-4111-8111-111111111111",
            variables: {},
          },
        },
        { Authorization: "Bearer os_test123" },
      ),
    );

    expect(res.status).toBe(422);
    await expect(res.json()).resolves.toMatchObject({
      name: "validation_error",
      code: "validation_error",
      statusCode: 422,
      message: "Missing required template variable: PRODUCT",
      details: {
        fieldErrors: {
          template: ["Missing required variable: PRODUCT"],
        },
      },
    });
    expect(mockReserveEmailQuota).not.toHaveBeenCalled();
    expect(nonLogInsertCalls()).toHaveLength(0);
  });

  it("audits queue publish failures before returning 500 and releasing quota", async () => {
    const emailId = "queue-fail-email-uuid";
    mockReserveEmailQuota.mockResolvedValue({ ok: true, bypassed: false });
    const returning = vi.fn().mockResolvedValue([{ id: emailId }]);
    const valuesMock = vi.fn().mockReturnValue({ returning });
    mockDb.insert = vi.fn().mockReturnValue({ values: valuesMock });

    const updateWhere = vi.fn().mockResolvedValue(undefined);
    const updateSet = vi.fn().mockReturnValue({ where: updateWhere });
    mockDb.update = vi.fn().mockReturnValue({ set: updateSet });
    mockPublishBackgroundJob.mockRejectedValue(
      Object.assign(new Error("SQS unavailable"), { name: "QueueUnavailable" }),
    );

    const { POST } = await import("@/app/api/emails/route");
    const res = await POST(
      makeRequest(
        "POST",
        {
          from: "sender@domain.com",
          to: ["user@test.com"],
          subject: "Test Email",
          html: "<p>Hello</p>",
        },
        { Authorization: "Bearer os_test123" },
      ),
    );

    expect(res.status).toBe(500);
    expect(updateSet).toHaveBeenCalledWith({
      status: "failed",
      providerLastAttemptedAt: expect.any(Date),
      providerLastErrorCode: "QueueUnavailable",
      providerLastErrorMessage: "SQS unavailable",
      providerNextRetryAt: null,
      providerDeadLetteredAt: expect.any(Date),
    });
    expect(valuesMock).toHaveBeenCalledWith({
      emailId,
      userId: AUTH_RESULT.userId,
      sourceId: `queue-publish-failed:${emailId}`,
      type: "failed",
      payload: {
        reason: "queue_publish_failed",
        error: {
          code: "QueueUnavailable",
          message: "SQS unavailable",
        },
      },
      receivedAt: expect.any(Date),
    });
    expect(mockReleaseEmailQuota).toHaveBeenCalledWith(AUTH_RESULT.userId, 1);
  });

  it("replays the accepted id for duplicate Idempotency-Key retries within the authenticated user scope", async () => {
    const findFirst = vi.fn().mockResolvedValue({ id: "email-1" });
    Object.assign(mockDb.query, {
      emails: { findFirst },
      contacts: { findFirst: vi.fn().mockResolvedValue(null) },
    });

    const { POST } = await import("@/app/api/emails/route");
    const res = await POST(
      makeRequest(
        "POST",
        {
          from: "sender@domain.com",
          to: ["user@test.com"],
          subject: "Test Email",
          html: "<p>Hello</p>",
        },
        {
          Authorization: "Bearer os_test123",
          "Idempotency-Key": "send-key-1",
        },
      ),
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ id: "email-1" });
    expect(findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({
        op: "and",
        args: expect.arrayContaining([
          expect.objectContaining({
            op: "eq",
            args: expect.arrayContaining(["send-key-1"]),
          }),
          expect.objectContaining({
            op: "eq",
            args: expect.arrayContaining([AUTH_RESULT.userId]),
          }),
          expect.objectContaining({
            op: "gte",
            args: expect.arrayContaining([expect.any(Date)]),
          }),
        ]),
      }),
    });
    expect(mockReserveEmailQuota).not.toHaveBeenCalled();
    expect(nonLogInsertCalls()).toHaveLength(0);
  });

  it("accepts the same Idempotency-Key as a new send after the 24-hour window", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-12T12:00:00.000Z"));

    const findFirst = vi.fn().mockResolvedValue(null);
    Object.assign(mockDb.query, {
      emails: { findFirst },
      contacts: { findFirst: vi.fn().mockResolvedValue(null) },
      templates: { findFirst: vi.fn().mockResolvedValue(null) },
    });

    const valuesMock = vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([{ id: "email-new" }]),
    });
    mockDb.insert = vi.fn().mockReturnValue({ values: valuesMock });
    const updateWhere = vi.fn().mockResolvedValue(undefined);
    const updateSet = vi.fn().mockReturnValue({ where: updateWhere });
    mockDb.update = vi.fn().mockReturnValue({ set: updateSet });

    const { POST } = await import("@/app/api/emails/route");
    const res = await POST(
      makeRequest(
        "POST",
        {
          from: "sender@domain.com",
          to: ["user@test.com"],
          subject: "Fresh after expiry",
          html: "<p>Hello</p>",
        },
        {
          Authorization: "Bearer os_test123",
          "Idempotency-Key": "send-expired-key",
        },
      ),
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ id: "email-new" });
    expect(findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({
        op: "and",
        args: expect.arrayContaining([
          expect.objectContaining({
            op: "eq",
            args: expect.arrayContaining(["send-expired-key"]),
          }),
          expect.objectContaining({
            op: "eq",
            args: expect.arrayContaining([AUTH_RESULT.userId]),
          }),
          expect.objectContaining({
            op: "gte",
            args: expect.arrayContaining([
              new Date("2026-05-11T12:00:00.000Z"),
            ]),
          }),
        ]),
      }),
    });
    expect(updateSet).toHaveBeenCalledWith({ idempotencyKey: null });
    expect(updateWhere).toHaveBeenCalledWith(
      expect.objectContaining({
        op: "and",
        args: expect.arrayContaining([
          expect.objectContaining({
            op: "eq",
            args: expect.arrayContaining(["send-expired-key"]),
          }),
          expect.objectContaining({
            op: "eq",
            args: expect.arrayContaining([AUTH_RESULT.userId]),
          }),
          expect.objectContaining({
            op: "lt",
            args: expect.arrayContaining([
              new Date("2026-05-11T12:00:00.000Z"),
            ]),
          }),
        ]),
      }),
    );
    expect(valuesMock).toHaveBeenCalledWith(
      expect.objectContaining({ idempotencyKey: "send-expired-key" }),
    );
    expect(mockReserveEmailQuota).toHaveBeenCalledTimes(1);
    expect(mockPublishBackgroundJob).toHaveBeenCalledTimes(1);
  });

  it("returns p95 under 50ms when the SES mock takes 500ms", async () => {
    mockSendEmail.mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 500)),
    );

    let id = 0;
    mockDb.insert = vi.fn().mockImplementation(() => ({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockImplementation(() => {
          id += 1;
          return Promise.resolve([{ id: `email-${id}` }]);
        }),
      }),
    }));

    const { POST } = await import("@/app/api/emails/route");
    const durations: number[] = [];

    for (let i = 0; i < 5; i++) {
      const req = makeRequest(
        "POST",
        {
          from: "sender@domain.com",
          to: [`user-${i}@test.com`],
          subject: "Fast queue",
          html: "<p>Hello</p>",
        },
        { Authorization: "Bearer os_test123" },
      );

      const startedAt = performance.now();
      const res = await POST(req);
      durations.push(performance.now() - startedAt);
      expect(res.status).toBe(200);
    }

    const sorted = durations.toSorted((a, b) => a - b);
    const p95 =
      sorted[Math.ceil(sorted.length * 0.95) - 1] ?? Number.POSITIVE_INFINITY;

    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(p95).toBeLessThan(50);
  });

  it("accepts string to field and normalizes to array", async () => {
    mockSendEmail.mockResolvedValue({ id: "ses-msg-id" });
    let callCount = 0;
    mockDb.insert = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return {
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: "email-uuid" }]),
          }),
        };
      }
      return { values: vi.fn().mockResolvedValue(undefined) };
    });

    const { POST } = await import("@/app/api/emails/route");
    const req = makeRequest(
      "POST",
      {
        from: "sender@domain.com",
        to: "single@test.com",
        subject: "Test",
        html: "<p>Hi</p>",
      },
      { Authorization: "Bearer os_test123" },
    );
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(mockPublishBackgroundJob).toHaveBeenCalledOnce();
  });

  it("accepts array recipients plus cc, bcc, and reply_to forms", async () => {
    const valuesMock = vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([{ id: "email-recipients-uuid" }]),
    });
    mockDb.insert = vi.fn().mockReturnValue({ values: valuesMock });

    const { POST } = await import("@/app/api/emails/route");
    const res = await POST(
      makeRequest(
        "POST",
        {
          from: "sender@domain.com",
          to: ["first@test.com", "second@test.com"],
          cc: "cc@test.com",
          bcc: ["bcc-one@test.com", "bcc-two@test.com"],
          reply_to: ["reply-one@test.com", "reply-two@test.com"],
          subject: "Recipient forms",
          html: "<p>Hi</p>",
        },
        { Authorization: "Bearer os_test123" },
      ),
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      id: "email-recipients-uuid",
    });
    expect(valuesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ["first@test.com", "second@test.com"],
        cc: ["cc@test.com"],
        bcc: ["bcc-one@test.com", "bcc-two@test.com"],
        replyTo: ["reply-one@test.com", "reply-two@test.com"],
      }),
    );
  });

  it("persists valid Resend-compatible tags unchanged", async () => {
    const valuesMock = vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([{ id: "email-tags-uuid" }]),
    });
    mockDb.insert = vi.fn().mockReturnValue({ values: valuesMock });

    const tags = [
      { name: "campaign_id", value: "spring-2026" },
      { name: "tenant-1", value: "A_B-123" },
    ];

    const { POST } = await import("@/app/api/emails/route");
    const req = makeRequest(
      "POST",
      {
        from: "sender@domain.com",
        to: "tagged@test.com",
        subject: "Tagged",
        html: "<p>Hi</p>",
        tags,
      },
      { Authorization: "Bearer os_test123" },
    );

    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(valuesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        tags,
      }),
    );
  });

  it("rejects tag names and values with non-Resend characters before insert", async () => {
    const { POST } = await import("@/app/api/emails/route");
    const req = makeRequest(
      "POST",
      {
        from: "sender@domain.com",
        to: "tagged@test.com",
        subject: "Bad tags",
        html: "<p>Hi</p>",
        tags: [{ name: "campaign.id", value: "spring 2026" }],
      },
      { Authorization: "Bearer os_test123" },
    );

    const res = await POST(req);

    expect(res.status).toBe(422);
    await expect(res.json()).resolves.toMatchObject({
      name: "validation_error",
      details: {
        fieldErrors: {
          "tags.0.name": [
            expect.stringContaining("ASCII letters, numbers, underscores"),
          ],
          "tags.0.value": [
            expect.stringContaining("ASCII letters, numbers, underscores"),
          ],
        },
      },
    });
    expect(mockReserveEmailQuota).not.toHaveBeenCalled();
    expect(nonLogInsertCalls()).toHaveLength(0);
    expect(mockPublishBackgroundJob).not.toHaveBeenCalled();
  });

  it("rejects overlong tag names and values before insert", async () => {
    const { POST } = await import("@/app/api/emails/route");
    const basePayload = {
      from: "sender@domain.com",
      to: "tagged@test.com",
      subject: "Long tags",
      html: "<p>Hi</p>",
    };

    for (const tags of [
      [{ name: "n".repeat(257), value: "ok" }],
      [{ name: "name", value: "v".repeat(257) }],
    ]) {
      const res = await POST(
        makeRequest(
          "POST",
          { ...basePayload, tags },
          {
            Authorization: "Bearer os_test123",
          },
        ),
      );

      expect(res.status).toBe(422);
      await expect(res.json()).resolves.toMatchObject({
        name: "validation_error",
        details: {
          fieldErrors: expect.objectContaining({
            [tags[0]?.name === "name" ? "tags.0.value" : "tags.0.name"]: [
              expect.stringContaining("no more than 256 characters"),
            ],
          }),
        },
      });
    }

    expect(mockReserveEmailQuota).not.toHaveBeenCalled();
    expect(nonLogInsertCalls()).toHaveLength(0);
    expect(mockPublishBackgroundJob).not.toHaveBeenCalled();
  });

  it("rejects more than 75 tags on a single email before insert", async () => {
    const { POST } = await import("@/app/api/emails/route");
    const req = makeRequest(
      "POST",
      {
        from: "sender@domain.com",
        to: "tagged@test.com",
        subject: "Too many tags",
        html: "<p>Hi</p>",
        tags: Array.from({ length: 76 }, (_, index) => ({
          name: `tag_${index}`,
          value: "ok",
        })),
      },
      { Authorization: "Bearer os_test123" },
    );

    const res = await POST(req);

    expect(res.status).toBe(422);
    await expect(res.json()).resolves.toMatchObject({
      name: "validation_error",
      details: {
        fieldErrors: {
          tags: [expect.stringContaining("75")],
        },
      },
    });
    expect(mockReserveEmailQuota).not.toHaveBeenCalled();
    expect(nonLogInsertCalls()).toHaveLength(0);
    expect(mockPublishBackgroundJob).not.toHaveBeenCalled();
  });

  it("injects one-click unsubscribe headers and replaces the managed URL placeholder for known contact sends", async () => {
    process.env.UNSUBSCRIBE_SECRET = "test-unsubscribe-secret";
    Object.assign(mockDb.query, {
      contacts: {
        findFirst: vi.fn().mockResolvedValue({
          id: "00000000-0000-4000-8000-000000000173",
          email: "known@test.com",
          unsubscribed: false,
        }),
      },
    });
    const valuesMock = vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([{ id: "email-uuid" }]),
    });
    mockDb.insert = vi.fn().mockReturnValue({ values: valuesMock });

    const { POST } = await import("@/app/api/emails/route");
    const req = makeRequest(
      "POST",
      {
        from: "sender@domain.com",
        to: "known@test.com",
        subject: "Managed unsubscribe",
        html: '<p><a href="{{{RESEND_UNSUBSCRIBE_URL}}}">Unsubscribe</a></p>',
        headers: { "X-Custom": "ok" },
      },
      { Authorization: "Bearer os_test123" },
    );

    const res = await POST(req);

    expect(res.status).toBe(200);
    const persisted = valuesMock.mock.calls[0][0];
    expect(persisted.html).toContain(
      "http://localhost:3015/unsubscribe/00000000-0000-4000-8000-000000000173?token=",
    );
    expect(persisted.html).not.toContain("{{{RESEND_UNSUBSCRIBE_URL}}}");
    expect(persisted.headers).toMatchObject({
      "X-Custom": "ok",
      "List-Unsubscribe": expect.stringContaining(
        "<http://localhost:3015/unsubscribe/00000000-0000-4000-8000-000000000173?token=",
      ),
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    });
  });

  it("accepts resend.dev delivered test recipients through the normal queued response shape", async () => {
    const valuesMock = vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([{ id: "email-sandbox-1" }]),
    });
    mockDb.insert = vi.fn().mockReturnValue({ values: valuesMock });

    const { POST } = await import("@/app/api/emails/route");
    const req = makeRequest(
      "POST",
      {
        from: "onboarding@resend.dev",
        to: "delivered+signup@resend.dev",
        subject: "Sandbox delivered",
        html: "<p>Sandbox</p>",
      },
      { Authorization: "Bearer os_test123" },
    );

    const res = await POST(req);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ id: "email-sandbox-1" });
    expect(valuesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ["delivered+signup@resend.dev"],
        status: "queued",
      }),
    );
    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(mockPublishBackgroundJob).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "email.send:email-sandbox-1",
        type: "email.send",
        emailId: "email-sandbox-1",
      }),
      {
        deduplicationId: "email.send:email-sandbox-1",
        groupId: "email.send",
      },
    );
  });

  it("rejects suppressed resend.dev test recipients before quota, persistence, or queueing", async () => {
    const { POST } = await import("@/app/api/emails/route");
    const req = makeRequest(
      "POST",
      {
        from: "sender@domain.com",
        to: ["suppressed@resend.dev"],
        subject: "Suppressed sandbox",
        html: "<p>No send</p>",
      },
      { Authorization: "Bearer os_test123" },
    );

    const res = await POST(req);

    expect(res.status).toBe(422);
    await expect(res.json()).resolves.toMatchObject({
      name: "recipient_suppressed",
      code: "recipient_suppressed",
      statusCode: 422,
      details: {
        recipients: "suppressed@resend.dev",
        reason: "suppressed",
        scope: "sandbox",
      },
    });
    expect(mockEnqueueEmailWebhookEvent).toHaveBeenCalledWith({
      type: "email.suppressed",
      userId: "user-1",
      payload: {
        reason: "recipient_suppressed",
        recipients: [{ email: "suppressed@resend.dev", reason: "suppressed" }],
        recipient_count: 1,
        submitted_at: expect.any(String),
      },
      receivedAt: expect.any(Date),
    });
    expect(mockReserveEmailQuota).not.toHaveBeenCalled();
    expect(nonLogInsertCalls()).toHaveLength(0);
    expect(mockPublishBackgroundJob).not.toHaveBeenCalled();
  });

  it("rejects suppressed to recipients before quota, persistence, or queueing", async () => {
    mockDb.select = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([
          {
            email: "blocked@test.com",
            reason: "bounced",
            suppressedAt: new Date("2026-05-05T00:00:00Z"),
          },
        ]),
      }),
    });

    const { POST } = await import("@/app/api/emails/route");
    const req = makeRequest(
      "POST",
      {
        from: "sender@domain.com",
        to: ["blocked@test.com"],
        subject: "Suppressed",
        html: "<p>No send</p>",
      },
      { Authorization: "Bearer os_test123" },
    );

    const res = await POST(req);

    expect(res.status).toBe(422);
    await expect(res.json()).resolves.toMatchObject({
      name: "recipient_suppressed",
      code: "recipient_suppressed",
      statusCode: 422,
      details: {
        recipients: "blocked@test.com",
        reason: "bounced",
        scope: "user",
      },
    });
    expect(mockEnqueueEmailWebhookEvent).toHaveBeenCalledWith({
      type: "email.suppressed",
      userId: "user-1",
      payload: {
        reason: "recipient_suppressed",
        recipients: [{ email: "blocked@test.com", reason: "bounced" }],
        recipient_count: 1,
        submitted_at: expect.any(String),
      },
      receivedAt: expect.any(Date),
    });
    expect(mockReserveEmailQuota).not.toHaveBeenCalled();
    expect(nonLogInsertCalls()).toHaveLength(0);
    expect(mockPublishBackgroundJob).not.toHaveBeenCalled();
  });

  it("stores attachment ids and queues delivery without direct SES", async () => {
    mockSendEmail.mockResolvedValue({ id: "ses-msg-id" });
    const valuesMock = vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([{ id: "email-uuid" }]),
    });
    mockDb.insert = vi.fn().mockReturnValue({ values: valuesMock });

    const { POST } = await import("@/app/api/emails/route");
    const req = makeRequest(
      "POST",
      {
        from: "sender@domain.com",
        to: ["single@test.com"],
        subject: "Test",
        html: "<p>Hi</p>",
        attachments: [
          { filename: "inline.txt", content: "aGVsbG8=" },
          {
            filename: "remote.png",
            path: "https://example.com/file.png",
            content_type: "image/png",
            content_id: "hero",
          },
        ],
      },
      { Authorization: "Bearer os_test123" },
    );

    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(mockPublishBackgroundJob).toHaveBeenCalledOnce();
    expect(valuesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        attachments: [
          expect.objectContaining({
            id: expect.any(String),
            filename: "inline.txt",
            content: "aGVsbG8=",
          }),
          expect.objectContaining({
            id: expect.any(String),
            filename: "remote.png",
            path: "https://example.com/file.png",
            content_type: "image/png",
            content_id: "hero",
          }),
        ],
      }),
    );
  });

  it("rejects attachments without content or path before quota, persistence, or queueing", async () => {
    const { POST } = await import("@/app/api/emails/route");
    const res = await POST(
      makeRequest(
        "POST",
        {
          from: "sender@domain.com",
          to: ["single@test.com"],
          subject: "Test",
          html: "<p>Hi</p>",
          attachments: [{ filename: "missing.txt" }],
        },
        { Authorization: "Bearer os_test123" },
      ),
    );

    expect(res.status).toBe(422);
    await expect(res.json()).resolves.toMatchObject({
      name: "validation_error",
      details: {
        fieldErrors: {
          "attachments.0.content": ["attachment requires content or path"],
        },
      },
    });
    expect(mockReserveEmailQuota).not.toHaveBeenCalled();
    expect(nonLogInsertCalls()).toHaveLength(0);
    expect(mockPublishBackgroundJob).not.toHaveBeenCalled();
  });

  it("rejects inline attachments above 40MB encoded before queueing", async () => {
    const { POST } = await import("@/app/api/emails/route");
    const res = await POST(
      makeRequest(
        "POST",
        {
          from: "sender@domain.com",
          to: ["single@test.com"],
          subject: "Test",
          html: "<p>Hi</p>",
          attachments: [
            {
              filename: "large.txt",
              content: "a".repeat(40 * 1024 * 1024 + 1),
            },
          ],
        },
        { Authorization: "Bearer os_test123" },
      ),
    );

    expect(res.status).toBe(422);
    await expect(res.json()).resolves.toMatchObject({
      name: "validation_error",
      details: {
        fieldErrors: {
          attachments: [
            "attachments must be no more than 40MB per email after Base64 encoding",
          ],
        },
      },
    });
    expect(mockReserveEmailQuota).not.toHaveBeenCalled();
    expect(nonLogInsertCalls()).toHaveLength(0);
    expect(mockPublishBackgroundJob).not.toHaveBeenCalled();
  });
  it("normalizes future ISO and natural-language scheduled_at values without queueing", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-07T00:00:00.000Z"));

    let callCount = 0;
    const valuesMock = vi.fn().mockImplementation(() => ({
      returning: vi.fn().mockResolvedValue([{ id: `email-${++callCount}` }]),
    }));
    mockDb.insert = vi.fn().mockReturnValue({ values: valuesMock });

    const { POST } = await import("@/app/api/emails/route");

    const isoRes = await POST(
      makeRequest(
        "POST",
        {
          from: "sender@domain.com",
          to: ["iso@test.com"],
          subject: "ISO",
          html: "<p>ISO</p>",
          scheduled_at: "2026-05-08T00:00:00.000Z",
        },
        { Authorization: "Bearer os_test123" },
      ),
    );
    const naturalRes = await POST(
      makeRequest(
        "POST",
        {
          from: "sender@domain.com",
          to: ["natural@test.com"],
          subject: "Natural",
          html: "<p>Natural</p>",
          scheduled_at: "in 1 min",
        },
        { Authorization: "Bearer os_test123" },
      ),
    );

    expect(isoRes.status).toBe(200);
    expect(naturalRes.status).toBe(200);
    expect(valuesMock.mock.calls[0][0]).toMatchObject({
      status: "scheduled",
      scheduledAt: new Date("2026-05-08T00:00:00.000Z"),
    });
    expect(valuesMock.mock.calls[2][0]).toMatchObject({
      status: "scheduled",
      scheduledAt: new Date("2026-05-07T00:01:00.000Z"),
    });
    expect(mockPublishBackgroundJob).not.toHaveBeenCalled();
    expect(mockEnqueueEmailWebhookEvent).toHaveBeenCalledTimes(2);
    expect(mockEnqueueEmailWebhookEvent).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        type: "email.scheduled",
        userId: "user-1",
        emailId: "email-1",
        sourceId: "scheduled:email-1",
        payload: expect.objectContaining({
          email_id: "email-1",
          scheduled_at: "2026-05-08T00:00:00.000Z",
          recipient_count: 1,
        }),
      }),
    );
    expect(mockEnqueueEmailWebhookEvent).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        type: "email.scheduled",
        userId: "user-1",
        emailId: "email-3",
        sourceId: "scheduled:email-3",
        payload: expect.objectContaining({
          email_id: "email-3",
          scheduled_at: "2026-05-07T00:01:00.000Z",
          recipient_count: 1,
        }),
      }),
    );
  });

  it("rejects invalid, past, and out-of-policy scheduled_at values before quota or insert", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-07T00:00:00.000Z"));

    const { POST } = await import("@/app/api/emails/route");
    const payload = {
      from: "sender@domain.com",
      to: ["user@test.com"],
      subject: "Bad schedule",
      html: "<p>Bad</p>",
    };

    for (const scheduled_at of [
      "tomorrow",
      "2026-05-06T23:59:00.000Z",
      "in 31 days",
    ]) {
      const res = await POST(
        makeRequest(
          "POST",
          { ...payload, scheduled_at },
          { Authorization: "Bearer os_test123" },
        ),
      );
      expect(res.status).toBe(422);
      await expect(res.json()).resolves.toMatchObject({
        name: "validation_error",
        details: {
          fieldErrors: {
            scheduled_at: [expect.stringContaining("future ISO 8601")],
          },
        },
      });
    }

    expect(mockReserveEmailQuota).not.toHaveBeenCalled();
    expect(nonLogInsertCalls()).toHaveLength(0);
    expect(mockPublishBackgroundJob).not.toHaveBeenCalled();
  });
});

// ── POST /api/emails/batch Tests ──────────────────────────────────

describe("POST /api/emails/batch", () => {
  beforeEach(() => {
    vi.resetModules();
    mockSendEmail.mockReset();
    mockPublishBackgroundJob.mockReset();
    mockEmitCloudWatchMetric.mockReset();
    mockEnqueueEmailWebhookEvent.mockReset();
    mockEnqueueEmailWebhookEvent.mockResolvedValue({
      eventId: "event-1",
      deliveryIds: [],
    });
    mockLogTelemetry.mockReset();
    mockRecordTelemetryError.mockReset();
    mockReserveEmailQuota.mockReset();
    mockReleaseEmailQuota.mockReset();
    mockReleaseEmailQuota.mockResolvedValue(undefined);
    mockReserveEmailQuota.mockResolvedValue({ ok: true, bypassed: true });
    mockGetApiKeyAuthHeaderError.mockReturnValue(null);
    Object.assign(mockDb.query, {
      emails: { findFirst: vi.fn().mockResolvedValue(null) },
      contacts: { findFirst: vi.fn().mockResolvedValue(null) },
    });
    mockDb.insert = vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    });
    mockDb.select = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    });
    mockDb.update = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });
    mockDb.transaction.mockImplementation(
      async (callback: (tx: typeof mockDb) => unknown) => callback(mockDb),
    );
    mockPublishBackgroundJob.mockResolvedValue({
      status: "skipped",
      reason: "queue_url_missing",
    });
    mockValidateApiKey.mockResolvedValue(AUTH_RESULT);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("rejects batch exceeding 100 emails", async () => {
    const { POST } = await import("@/app/api/emails/batch/route");
    const emailsArr = Array.from({ length: 101 }, (_, i) => ({
      from: `sender${i}@domain.com`,
      to: [`user${i}@test.com`],
      subject: `Test ${i}`,
      html: `<p>${i}</p>`,
    }));
    const req = makeRequest("POST", emailsArr, {
      Authorization: "Bearer os_test123",
    });
    const res = await POST(req);
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json).toMatchObject({
      name: "validation_error",
      code: "validation_error",
      message: "Validation failed.",
      statusCode: 422,
    });
    expect(json.details.formErrors[0]).toContain("100");
  });

  it("returns 400 with invalid_json for malformed batch JSON", async () => {
    const { POST } = await import("@/app/api/emails/batch/route");
    const req = new Request("http://localhost:3015/api/emails/batch", {
      method: "POST",
      headers: {
        Authorization: "Bearer os_test123",
        "Content-Type": "application/json",
      },
      body: "[",
    });

    const res = await POST(req);

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      name: "invalid_json",
      code: "invalid_json",
      statusCode: 400,
    });
  });

  it("accepts a 256-character batch Idempotency-Key", async () => {
    const valuesMock = vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([{ id: "email-256-key" }]),
    });
    mockDb.insert = vi.fn().mockReturnValue({ values: valuesMock });

    const { POST } = await import("@/app/api/emails/batch/route");
    const res = await POST(
      makeRequest(
        "POST",
        [
          {
            from: "sender@domain.com",
            to: ["user@test.com"],
            subject: "Test",
            html: "<p>Test</p>",
          },
        ],
        {
          Authorization: "Bearer os_test123",
          "Idempotency-Key": "x".repeat(256),
        },
      ),
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      data: [{ id: "email-256-key" }],
    });
    expect(valuesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: "x".repeat(256),
      }),
    );
  });

  it("returns 400 for an invalid batch Idempotency-Key before reserving quota", async () => {
    const { POST } = await import("@/app/api/emails/batch/route");
    const req = makeRequest(
      "POST",
      [
        {
          from: "sender@domain.com",
          to: ["user@test.com"],
          subject: "Test",
          html: "<p>Test</p>",
        },
      ],
      {
        Authorization: "Bearer os_test123",
        "Idempotency-Key": "x".repeat(257),
      },
    );

    const res = await POST(req);

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      name: "invalid_idempotency_key",
      code: "invalid_idempotency_key",
      statusCode: 400,
    });
    expect(mockReserveEmailQuota).not.toHaveBeenCalled();
    expect(mockPublishBackgroundJob).not.toHaveBeenCalled();
  });

  it("replays duplicate batch Idempotency-Key retries before quota, rows, or queue", async () => {
    const acceptedBatchResponse = {
      data: [{ id: "email-1" }, { id: "email-2" }],
    };
    const findFirst = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "email-1",
        document: {
          idempotency: {
            endpoint: "emails.batch",
            response: acceptedBatchResponse,
          },
        },
      });
    Object.assign(mockDb.query, {
      emails: { findFirst },
      contacts: { findFirst: vi.fn().mockResolvedValue(null) },
    });

    let callCount = 0;
    const valuesMock = vi.fn().mockImplementation(() => ({
      returning: vi.fn().mockResolvedValue([{ id: `email-${++callCount}` }]),
    }));
    const updateWhere = vi.fn().mockResolvedValue(undefined);
    const updateSet = vi.fn().mockReturnValue({ where: updateWhere });
    mockDb.insert = vi.fn().mockReturnValue({ values: valuesMock });
    mockDb.update = vi.fn().mockReturnValue({ set: updateSet });

    const { POST } = await import("@/app/api/emails/batch/route");
    const emailsArr = [
      {
        from: "sender@domain.com",
        to: ["user1@test.com"],
        subject: "Test 1",
        html: "<p>1</p>",
        attachments: [
          {
            filename: "batch-remote.png",
            path: "https://example.com/batch-remote.png",
            content_type: "image/png",
            content_id: "batch-remote",
          },
        ],
      },
      {
        from: "sender@domain.com",
        to: ["user2@test.com"],
        subject: "Test 2",
        html: "<p>2</p>",
      },
    ];

    const first = await POST(
      makeRequest("POST", emailsArr, {
        Authorization: "Bearer os_test123",
        "Idempotency-Key": "batch-key-1",
      }),
    );
    const retry = await POST(
      makeRequest("POST", emailsArr, {
        Authorization: "Bearer os_test123",
        "Idempotency-Key": "batch-key-1",
      }),
    );

    expect(first.status).toBe(200);
    await expect(first.json()).resolves.toEqual(acceptedBatchResponse);
    expect(retry.status).toBe(200);
    await expect(retry.json()).resolves.toEqual(acceptedBatchResponse);

    expect(mockReserveEmailQuota).toHaveBeenCalledTimes(1);
    expect(nonLogInsertCalls()).toHaveLength(2);
    expect(mockPublishBackgroundJob).toHaveBeenCalledTimes(2);
    expect(findFirst).toHaveBeenNthCalledWith(1, {
      where: expect.objectContaining({
        op: "and",
        args: expect.arrayContaining([
          expect.objectContaining({
            op: "eq",
            args: expect.arrayContaining(["batch-key-1"]),
          }),
          expect.objectContaining({
            op: "eq",
            args: expect.arrayContaining([AUTH_RESULT.userId]),
          }),
          expect.objectContaining({
            op: "gte",
            args: expect.arrayContaining([expect.any(Date)]),
          }),
        ]),
      }),
    });
    expect(findFirst).toHaveBeenNthCalledWith(2, {
      where: expect.objectContaining({
        op: "and",
        args: expect.arrayContaining([
          expect.objectContaining({
            op: "eq",
            args: expect.arrayContaining(["batch-key-1"]),
          }),
          expect.objectContaining({
            op: "eq",
            args: expect.arrayContaining([AUTH_RESULT.userId]),
          }),
          expect.objectContaining({
            op: "gte",
            args: expect.arrayContaining([expect.any(Date)]),
          }),
        ]),
      }),
    });
    expect(
      valuesMock.mock.calls
        .map(([value]) => value.idempotencyKey)
        .filter((value) => value !== undefined),
    ).toEqual(["batch-key-1", null]);
    expect(updateSet).toHaveBeenCalledWith({
      document: {
        idempotency: {
          endpoint: "emails.batch",
          response: acceptedBatchResponse,
        },
      },
    });
    expect(updateWhere).toHaveBeenCalledWith(
      expect.objectContaining({
        op: "and",
        args: expect.arrayContaining([
          expect.objectContaining({
            op: "eq",
            args: expect.arrayContaining(["email-1"]),
          }),
          expect.objectContaining({
            op: "eq",
            args: expect.arrayContaining([AUTH_RESULT.userId]),
          }),
        ]),
      }),
    );
  });

  it("accepts the same batch Idempotency-Key as a new batch after the 24-hour window", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-12T12:00:00.000Z"));

    const findFirst = vi.fn().mockResolvedValue(null);
    Object.assign(mockDb.query, {
      emails: { findFirst },
      contacts: { findFirst: vi.fn().mockResolvedValue(null) },
    });

    let callCount = 0;
    const valuesMock = vi.fn().mockImplementation(() => ({
      returning: vi
        .fn()
        .mockResolvedValue([{ id: `batch-new-${++callCount}` }]),
    }));
    const updateWhere = vi.fn().mockResolvedValue(undefined);
    const updateSet = vi.fn().mockReturnValue({ where: updateWhere });
    mockDb.insert = vi.fn().mockReturnValue({ values: valuesMock });
    mockDb.update = vi.fn().mockReturnValue({ set: updateSet });

    const { POST } = await import("@/app/api/emails/batch/route");
    const res = await POST(
      makeRequest(
        "POST",
        [
          {
            from: "sender@domain.com",
            to: ["user1@test.com"],
            subject: "Fresh batch after expiry 1",
            html: "<p>1</p>",
          },
          {
            from: "sender@domain.com",
            to: ["user2@test.com"],
            subject: "Fresh batch after expiry 2",
            html: "<p>2</p>",
          },
        ],
        {
          Authorization: "Bearer os_test123",
          "Idempotency-Key": "batch-expired-key",
        },
      ),
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      data: [{ id: "batch-new-1" }, { id: "batch-new-2" }],
    });
    expect(findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({
        op: "and",
        args: expect.arrayContaining([
          expect.objectContaining({
            op: "eq",
            args: expect.arrayContaining(["batch-expired-key"]),
          }),
          expect.objectContaining({
            op: "eq",
            args: expect.arrayContaining([AUTH_RESULT.userId]),
          }),
          expect.objectContaining({
            op: "gte",
            args: expect.arrayContaining([
              new Date("2026-05-11T12:00:00.000Z"),
            ]),
          }),
        ]),
      }),
    });
    expect(updateSet).toHaveBeenCalledWith({ idempotencyKey: null });
    expect(updateWhere).toHaveBeenCalledWith(
      expect.objectContaining({
        op: "and",
        args: expect.arrayContaining([
          expect.objectContaining({
            op: "eq",
            args: expect.arrayContaining(["batch-expired-key"]),
          }),
          expect.objectContaining({
            op: "eq",
            args: expect.arrayContaining([AUTH_RESULT.userId]),
          }),
          expect.objectContaining({
            op: "lt",
            args: expect.arrayContaining([
              new Date("2026-05-11T12:00:00.000Z"),
            ]),
          }),
        ]),
      }),
    );
    expect(
      valuesMock.mock.calls
        .map(([value]) => value.idempotencyKey)
        .filter((value) => value !== undefined),
    ).toEqual(["batch-expired-key", null]);
    expect(mockReserveEmailQuota).toHaveBeenCalledTimes(1);
    expect(mockPublishBackgroundJob).toHaveBeenCalledTimes(2);
  });

  it("injects managed unsubscribe headers for batch items with known contact placeholders", async () => {
    process.env.UNSUBSCRIBE_SECRET = "test-unsubscribe-secret";
    Object.assign(mockDb.query, {
      contacts: {
        findFirst: vi.fn().mockResolvedValue({
          id: "00000000-0000-4000-8000-000000000174",
          email: "batch@test.com",
          unsubscribed: false,
        }),
      },
    });
    const valuesMock = vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([{ id: "email-batch-1" }]),
    });
    mockDb.insert = vi.fn().mockReturnValue({ values: valuesMock });

    const { POST } = await import("@/app/api/emails/batch/route");
    const req = makeRequest(
      "POST",
      [
        {
          from: "sender@domain.com",
          to: "batch@test.com",
          subject: "Batch",
          text: "Leave: {{{RESEND_UNSUBSCRIBE_URL}}}",
        },
      ],
      { Authorization: "Bearer os_test123" },
    );

    const res = await POST(req);

    expect(res.status).toBe(200);
    const persisted = valuesMock.mock.calls[0][0];
    expect(persisted.text).toContain(
      "http://localhost:3015/unsubscribe/00000000-0000-4000-8000-000000000174?token=",
    );
    expect(persisted.headers).toMatchObject({
      "List-Unsubscribe": expect.stringContaining(
        "<http://localhost:3015/unsubscribe/00000000-0000-4000-8000-000000000174?token=",
      ),
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    });
  });

  it("mixes real, sandbox delivered, and sandbox suppressed recipients in batch", async () => {
    let callCount = 0;
    mockDb.insert = vi.fn().mockImplementation(() => {
      callCount++;
      return {
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: `email-${callCount}` }]),
        }),
      };
    });

    const { POST } = await import("@/app/api/emails/batch/route");
    const req = makeRequest(
      "POST",
      [
        {
          from: "sender@domain.com",
          to: ["real@test.com"],
          subject: "Real",
          html: "<p>Real</p>",
        },
        {
          from: "onboarding@resend.dev",
          to: ["delivered@resend.dev"],
          subject: "Sandbox",
          html: "<p>Sandbox</p>",
        },
        {
          from: "sender@domain.com",
          to: ["suppressed@resend.dev"],
          subject: "Suppressed",
          html: "<p>Suppressed</p>",
        },
      ],
      { Authorization: "Bearer os_test123" },
    );

    const res = await POST(req);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      data: [
        { id: "email-1" },
        { id: "email-2" },
        {
          error: {
            code: "recipient_suppressed",
            statusCode: 422,
            details: {
              recipients: "suppressed@resend.dev",
              reason: "suppressed",
              scope: "sandbox",
            },
          },
        },
      ],
    });
    expect(mockReserveEmailQuota).toHaveBeenCalledWith(
      "user-1",
      2,
      expect.any(Date),
      process.env,
      mockDb,
    );
    expect(nonLogInsertCalls()).toHaveLength(2);
    expect(mockPublishBackgroundJob).toHaveBeenCalledTimes(2);
    expect(mockEnqueueEmailWebhookEvent).toHaveBeenCalledWith({
      type: "email.suppressed",
      userId: "user-1",
      payload: {
        reason: "recipient_suppressed",
        recipients: [{ email: "suppressed@resend.dev", reason: "suppressed" }],
        recipient_count: 1,
        submitted_at: expect.any(String),
      },
      receivedAt: expect.any(Date),
    });
  });

  it("returns per-item suppression errors while preserving accepted batch sends", async () => {
    mockDb.select = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([
          {
            email: "blocked@test.com",
            reason: "complained",
            suppressedAt: new Date("2026-05-05T00:00:00Z"),
          },
        ]),
      }),
    });
    const valuesMock = vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([{ id: "email-accepted-1" }]),
    });
    mockDb.insert = vi.fn().mockReturnValue({ values: valuesMock });

    const { POST } = await import("@/app/api/emails/batch/route");
    const req = makeRequest(
      "POST",
      [
        {
          from: "sender@domain.com",
          to: ["ok@test.com"],
          subject: "OK",
          html: "<p>OK</p>",
        },
        {
          from: "sender@domain.com",
          to: ["blocked@test.com"],
          subject: "Blocked",
          html: "<p>Blocked</p>",
        },
      ],
      { Authorization: "Bearer os_test123" },
    );

    const res = await POST(req);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      data: [
        { id: "email-accepted-1" },
        {
          error: {
            code: "recipient_suppressed",
            statusCode: 422,
            details: {
              recipients: "blocked@test.com",
              reason: "complained",
              scope: "user",
            },
          },
        },
      ],
    });
    expect(mockReserveEmailQuota).toHaveBeenCalledWith(
      "user-1",
      1,
      expect.any(Date),
      process.env,
      mockDb,
    );
    expect(nonLogInsertCalls()).toHaveLength(1);
    expect(mockPublishBackgroundJob).toHaveBeenCalledTimes(1);
    expect(mockEnqueueEmailWebhookEvent).toHaveBeenCalledWith({
      type: "email.suppressed",
      userId: "user-1",
      payload: {
        reason: "recipient_suppressed",
        recipients: [{ email: "blocked@test.com", reason: "complained" }],
        recipient_count: 1,
        submitted_at: expect.any(String),
      },
      receivedAt: expect.any(Date),
    });
  });

  it("sends batch and returns array of ids", async () => {
    mockSendEmail.mockResolvedValue({ id: "ses-msg-id" });
    let callCount = 0;
    mockDb.insert = vi.fn().mockImplementation(() => {
      callCount++;
      return {
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: `email-${callCount}` }]),
        }),
      };
    });

    const { POST } = await import("@/app/api/emails/batch/route");
    const emailsArr = [
      {
        from: "sender@domain.com",
        to: ["user1@test.com"],
        subject: "Test 1",
        html: "<p>1</p>",
      },
      {
        from: "sender@domain.com",
        to: ["user2@test.com"],
        subject: "Test 2",
        html: "<p>2</p>",
      },
    ];
    const req = makeRequest("POST", emailsArr, {
      Authorization: "Bearer os_test123",
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveProperty("data");
    expect(json.data).toHaveLength(2);
    expect(json.data[0]).toHaveProperty("id");
    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(mockPublishBackgroundJob).toHaveBeenCalledTimes(2);
  });

  it("rejects invalid tags on the specific batch item before any rows", async () => {
    const { POST } = await import("@/app/api/emails/batch/route");
    const res = await POST(
      makeRequest(
        "POST",
        [
          {
            from: "sender@domain.com",
            to: ["ok@test.com"],
            subject: "OK",
            html: "<p>OK</p>",
            tags: [{ name: "valid_name", value: "valid-value" }],
          },
          {
            from: "sender@domain.com",
            to: ["bad@test.com"],
            subject: "Bad",
            html: "<p>Bad</p>",
            tags: [{ name: "bad.name", value: "bad value" }],
          },
        ],
        { Authorization: "Bearer os_test123" },
      ),
    );

    expect(res.status).toBe(422);
    await expect(res.json()).resolves.toMatchObject({
      name: "validation_error",
      details: {
        fieldErrors: {
          "1.tags.0.name": [
            expect.stringContaining("ASCII letters, numbers, underscores"),
          ],
          "1.tags.0.value": [
            expect.stringContaining("ASCII letters, numbers, underscores"),
          ],
        },
      },
    });
    expect(mockReserveEmailQuota).not.toHaveBeenCalled();
    expect(nonLogInsertCalls()).toHaveLength(0);
    expect(mockPublishBackgroundJob).not.toHaveBeenCalled();
  });

  it("rejects a batch item with more than 75 tags before any rows", async () => {
    const { POST } = await import("@/app/api/emails/batch/route");
    const res = await POST(
      makeRequest(
        "POST",
        [
          {
            from: "sender@domain.com",
            to: ["bad@test.com"],
            subject: "Too many batch tags",
            html: "<p>Bad</p>",
            tags: Array.from({ length: 76 }, (_, index) => ({
              name: `tag_${index}`,
              value: "ok",
            })),
          },
        ],
        { Authorization: "Bearer os_test123" },
      ),
    );

    expect(res.status).toBe(422);
    await expect(res.json()).resolves.toMatchObject({
      name: "validation_error",
      details: {
        fieldErrors: {
          "0.tags": [expect.stringContaining("75")],
        },
      },
    });
    expect(mockReserveEmailQuota).not.toHaveBeenCalled();
    expect(nonLogInsertCalls()).toHaveLength(0);
    expect(mockPublishBackgroundJob).not.toHaveBeenCalled();
  });

  it("normalizes batch ISO and natural-language scheduled_at values without queueing", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-07T00:00:00.000Z"));

    let callCount = 0;
    const valuesMock = vi.fn().mockImplementation(() => ({
      returning: vi.fn().mockResolvedValue([{ id: `email-${++callCount}` }]),
    }));
    mockDb.insert = vi.fn().mockReturnValue({ values: valuesMock });

    const { POST } = await import("@/app/api/emails/batch/route");
    const res = await POST(
      makeRequest(
        "POST",
        [
          {
            from: "sender@domain.com",
            to: ["iso@test.com"],
            subject: "ISO",
            html: "<p>ISO</p>",
            scheduled_at: "2026-05-08T00:00:00.000Z",
          },
          {
            from: "sender@domain.com",
            to: ["natural@test.com"],
            subject: "Natural",
            html: "<p>Natural</p>",
            scheduled_at: "in 2 hours",
          },
        ],
        { Authorization: "Bearer os_test123" },
      ),
    );

    expect(res.status).toBe(200);
    expect(valuesMock.mock.calls[0][0]).toMatchObject({
      status: "scheduled",
      scheduledAt: new Date("2026-05-08T00:00:00.000Z"),
    });
    expect(valuesMock.mock.calls[1][0]).toMatchObject({
      status: "scheduled",
      scheduledAt: new Date("2026-05-07T02:00:00.000Z"),
    });
    expect(mockPublishBackgroundJob).not.toHaveBeenCalled();
    expect(mockEnqueueEmailWebhookEvent).toHaveBeenCalledTimes(2);
    expect(mockEnqueueEmailWebhookEvent).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        type: "email.scheduled",
        userId: "user-1",
        emailId: "email-1",
        sourceId: "scheduled:email-1",
        payload: expect.objectContaining({
          email_id: "email-1",
          scheduled_at: "2026-05-08T00:00:00.000Z",
          recipient_count: 1,
        }),
      }),
    );
    expect(mockEnqueueEmailWebhookEvent).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        type: "email.scheduled",
        userId: "user-1",
        emailId: "email-2",
        sourceId: "scheduled:email-2",
        payload: expect.objectContaining({
          email_id: "email-2",
          scheduled_at: "2026-05-07T02:00:00.000Z",
          recipient_count: 1,
        }),
      }),
    );
  });

  it("rejects invalid, past, and out-of-policy batch scheduled_at before any rows", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-07T00:00:00.000Z"));

    const { POST } = await import("@/app/api/emails/batch/route");
    const base = {
      from: "sender@domain.com",
      to: ["user@test.com"],
      subject: "Bad batch schedule",
      html: "<p>Bad</p>",
    };

    for (const scheduled_at of [
      "next Friday",
      "2026-05-06T23:59:00.000Z",
      "in 31 days",
    ]) {
      const res = await POST(
        makeRequest("POST", [{ ...base, scheduled_at }], {
          Authorization: "Bearer os_test123",
        }),
      );
      expect(res.status).toBe(422);
      await expect(res.json()).resolves.toMatchObject({
        name: "validation_error",
        code: "validation_error",
      });
    }

    expect(mockReserveEmailQuota).not.toHaveBeenCalled();
    expect(nonLogInsertCalls()).toHaveLength(0);
    expect(mockPublishBackgroundJob).not.toHaveBeenCalled();
  });
});

// ── Hono services/api transactional send routes ───────────────────

describe("services/api transactional email routes", () => {
  beforeEach(() => {
    vi.resetModules();
    mockSendEmail.mockReset();
    mockPublishBackgroundJob.mockReset();
    mockEmitCloudWatchMetric.mockReset();
    mockEnqueueEmailWebhookEvent.mockReset();
    mockEnqueueEmailWebhookEvent.mockResolvedValue({
      eventId: "event-1",
      deliveryIds: [],
    });
    mockLogTelemetry.mockReset();
    mockRecordTelemetryError.mockReset();
    mockReserveEmailQuota.mockReset();
    mockReleaseEmailQuota.mockReset();
    mockReleaseEmailQuota.mockResolvedValue(undefined);
    mockReserveEmailQuota.mockResolvedValue({ ok: true, bypassed: true });
    mockGetApiKeyAuthHeaderError.mockImplementation(
      (authHeader: string | null | undefined) => {
        if (!authHeader) return "missing_api_key";
        const parts = authHeader.split(" ");
        return parts.length === 2 && parts[0] === "Bearer" && parts[1]
          ? null
          : "malformed_api_key";
      },
    );
    Object.assign(mockDb.query, {
      emails: { findFirst: vi.fn().mockResolvedValue(null) },
      contacts: { findFirst: vi.fn().mockResolvedValue(null) },
    });
    mockDb.select = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    });
    mockDb.update = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });
    mockDb.transaction.mockImplementation(
      async (callback: (tx: typeof mockDb) => unknown) => callback(mockDb),
    );
    mockPublishBackgroundJob.mockResolvedValue({
      status: "skipped",
      reason: "queue_url_missing",
    });
    mockValidateApiKey.mockResolvedValue(AUTH_RESULT);
  });

  it("exposes POST /emails with the same queued success shape", async () => {
    const valuesMock = vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([{ id: "svc-email-1" }]),
    });
    mockDb.insert = vi.fn().mockReturnValue({ values: valuesMock });

    const { createApp } = await import("../services/api/src/index");
    const res = await createApp().request("/emails", {
      method: "POST",
      headers: {
        Authorization: "Bearer os_test123",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "sender@domain.com",
        to: "svc@test.com",
        subject: "Service send",
        html: "<p>Hello</p>",
      }),
    });

    expect(res.status).toBe(200);
    expect(sendEmailResponseSchema.parse(await res.json())).toEqual({
      id: "svc-email-1",
    });
    expect(valuesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ["svc@test.com"],
        status: "queued",
      }),
    );
    expect(mockPublishBackgroundJob).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "email.send:svc-email-1",
        type: "email.send",
        source: "api",
        emailId: "svc-email-1",
      }),
      {
        deduplicationId: "email.send:svc-email-1",
        groupId: "email.send",
      },
    );
  });

  it("exposes POST /emails validation and auth errors with public envelopes", async () => {
    const { createApp } = await import("../services/api/src/index");
    const app = createApp();

    const unauthenticated = await app.request("/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(unauthenticated.status).toBe(401);
    expect(
      publicApiErrorEnvelopeSchema.parse(await unauthenticated.json()),
    ).toMatchObject({
      name: "missing_api_key",
      code: "missing_api_key",
      statusCode: 401,
    });

    const invalid = await app.request("/emails", {
      method: "POST",
      headers: {
        Authorization: "Bearer os_test123",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: "sender@domain.com" }),
    });
    expect(invalid.status).toBe(422);
    expect(
      publicApiErrorEnvelopeSchema.parse(await invalid.json()),
    ).toMatchObject({
      name: "validation_error",
      code: "validation_error",
      statusCode: 422,
      details: {
        fieldErrors: {
          to: [expect.any(String)],
          subject: [expect.any(String)],
        },
      },
    });
    expect(mockReserveEmailQuota).not.toHaveBeenCalled();
  });

  it("preserves service idempotency replay behavior before quota or rows", async () => {
    const findFirst = vi.fn().mockResolvedValue({ id: "existing-email" });
    Object.assign(mockDb.query, {
      emails: { findFirst },
      contacts: { findFirst: vi.fn().mockResolvedValue(null) },
    });
    mockDb.insert = vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    });

    const { createApp } = await import("../services/api/src/index");
    const res = await createApp().request("/emails", {
      method: "POST",
      headers: {
        Authorization: "Bearer os_test123",
        "Content-Type": "application/json",
        "Idempotency-Key": "svc-idempotency-1",
      },
      body: JSON.stringify({
        from: "sender@domain.com",
        to: "svc@test.com",
        subject: "Service send",
        html: "<p>Hello</p>",
      }),
    });

    expect(res.status).toBe(200);
    expect(sendEmailResponseSchema.parse(await res.json())).toEqual({
      id: "existing-email",
    });
    expect(mockReserveEmailQuota).not.toHaveBeenCalled();
    expect(nonLogInsertCalls()).toHaveLength(0);
  });

  it("exposes POST /emails/batch with compatible mixed item results", async () => {
    let callCount = 0;
    mockDb.insert = vi.fn().mockImplementation(() => ({
      values: vi.fn().mockReturnValue({
        returning: vi
          .fn()
          .mockResolvedValue([{ id: `svc-batch-${++callCount}` }]),
      }),
    }));

    const { createApp } = await import("../services/api/src/index");
    const res = await createApp().request("/emails/batch", {
      method: "POST",
      headers: {
        Authorization: "Bearer os_test123",
        "Content-Type": "application/json",
        "Idempotency-Key": "svc-batch-key-1",
      },
      body: JSON.stringify([
        {
          from: "sender@domain.com",
          to: "one@test.com",
          subject: "One",
          html: "<p>One</p>",
        },
        {
          from: "sender@domain.com",
          to: "suppressed@resend.dev",
          subject: "Suppressed",
          html: "<p>Suppressed</p>",
        },
      ]),
    });

    expect(res.status).toBe(200);
    expect(batchSendEmailResponseSchema.parse(await res.json())).toMatchObject({
      data: [
        { id: "svc-batch-1" },
        {
          error: {
            name: "recipient_suppressed",
            code: "recipient_suppressed",
            statusCode: 422,
          },
        },
      ],
    });
    expect(mockReserveEmailQuota).toHaveBeenCalledWith(
      AUTH_RESULT.userId,
      1,
      expect.any(Date),
      process.env,
      mockDb,
    );
    expect(mockPublishBackgroundJob).toHaveBeenCalledTimes(1);
    expect(
      nonLogInsertCalls()
        .map(([value]) => value)
        .filter(Boolean),
    ).toHaveLength(1);
  });
});

// ── GET /api/emails Tests ─────────────────────────────────────────

describe("GET /api/emails", () => {
  beforeEach(() => {
    vi.resetModules();
    mockEmailReadService.listEmails.mockReset();
    mockValidateApiKey.mockResolvedValue(AUTH_RESULT);
  });

  it("returns paginated list of emails", async () => {
    mockEmailReadService.listEmails.mockResolvedValueOnce({
      object: "list",
      has_more: false,
      data: [
        {
          id: "email-1",
          from: "sender@domain.com",
          to: ["user@test.com"],
          subject: "Test",
          created_at: new Date("2024-01-01"),
          last_event: "delivered",
          cc: null,
          bcc: null,
          reply_to: null,
          provider_retry_count: 0,
          provider_last_attempted_at: null,
          provider_next_retry_at: null,
          provider_last_error: null,
          provider_dead_lettered_at: null,
          scheduled_at: null,
          sent_at: new Date("2024-01-01T00:00:05Z"),
        },
      ],
    });

    const { GET } = await import("@/app/api/emails/route");
    const req = new Request("http://localhost:3015/api/emails?limit=20", {
      headers: { Authorization: "Bearer os_test123" },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveProperty("object", "list");
    expect(json).toHaveProperty("data");
    expect(Array.isArray(json.data)).toBe(true);
    expect(json.data[0]).toHaveProperty("sent_at", "2024-01-01T00:00:05.000Z");
    expect(mockEmailReadService.listEmails).toHaveBeenCalledWith({
      userId: AUTH_RESULT.userId,
      limit: 20,
      after: undefined,
      before: undefined,
      status: "",
    });
  });

  it("passes status filter so queued dashboard/API views return queued rows", async () => {
    mockEmailReadService.listEmails.mockResolvedValueOnce({
      object: "list",
      has_more: false,
      data: [
        {
          id: "email-1",
          from: "sender@domain.com",
          to: ["user@test.com"],
          subject: "Test",
          created_at: new Date("2024-01-01"),
          last_event: "queued",
          cc: null,
          bcc: null,
          reply_to: null,
          provider_retry_count: 0,
          provider_last_attempted_at: null,
          provider_next_retry_at: null,
          provider_last_error: null,
          provider_dead_lettered_at: null,
          sent_at: null,
          scheduled_at: null,
        },
      ],
    });

    const { GET } = await import("@/app/api/emails/route");
    const req = new Request("http://localhost:3015/api/emails?status=queued", {
      headers: { Authorization: "Bearer os_test123" },
    });

    const res = await GET(req);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      data: [{ last_event: "queued" }],
    });
    expect(mockEmailReadService.listEmails).toHaveBeenCalledWith({
      userId: AUTH_RESULT.userId,
      limit: 20,
      after: undefined,
      before: undefined,
      status: "queued",
    });
  });
});

// ── GET /api/emails/:id Tests ─────────────────────────────────────

describe("GET /api/emails/:id", () => {
  beforeEach(() => {
    vi.resetModules();
    mockEmailDetailService.getEmail.mockReset();
    mockValidateApiKey.mockResolvedValue(AUTH_RESULT);
  });

  it("returns email detail from the detail service", async () => {
    mockEmailDetailService.getEmail.mockResolvedValueOnce({
      object: "email",
      id: "email-uuid",
      from: "sender@domain.com",
      to: ["user@test.com"],
      subject: "Test",
      html: "<p>Hello</p>",
      text: null,
      cc: null,
      bcc: null,
      reply_to: null,
      last_event: "delivered",
      provider_retry_count: 0,
      provider_last_attempted_at: null,
      provider_next_retry_at: null,
      provider_last_error: null,
      provider_dead_lettered_at: null,
      scheduled_at: null,
      sent_at: new Date("2024-01-01T00:00:05Z"),
      tags: null,
      created_at: new Date("2024-01-01"),
    });

    const { GET } = await import("@/app/api/emails/[id]/route");
    const req = new Request("http://localhost:3015/api/emails/email-uuid", {
      headers: { Authorization: "Bearer os_test123" },
    });
    const res = await GET(req, {
      params: Promise.resolve({ id: "email-uuid" }),
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveProperty("object", "email");
    expect(json).toHaveProperty("id", "email-uuid");
    expect(json).toHaveProperty("last_event", "delivered");
    expect(json).toHaveProperty("sent_at", "2024-01-01T00:00:05.000Z");
    expect(mockEmailDetailService.getEmail).toHaveBeenCalledWith({
      userId: AUTH_RESULT.userId,
      id: "email-uuid",
    });
  });

  it("returns 404 for non-existent email", async () => {
    mockEmailDetailService.getEmail.mockRejectedValueOnce(
      new MockEmailDetailServiceError("not_found", "Email not found"),
    );

    const { GET } = await import("@/app/api/emails/[id]/route");
    const req = new Request("http://localhost:3015/api/emails/nonexistent", {
      headers: { Authorization: "Bearer os_test123" },
    });
    const res = await GET(req, {
      params: Promise.resolve({ id: "nonexistent" }),
    });
    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ error: "Email not found" });
    expect(mockEmailDetailService.getEmail).toHaveBeenCalledWith({
      userId: AUTH_RESULT.userId,
      id: "nonexistent",
    });
  });
});

describe("PATCH /api/emails/:id", () => {
  beforeEach(() => {
    vi.resetModules();
    mockEmailDetailService.updateEmail.mockReset();
    mockValidateApiKey.mockResolvedValue(AUTH_RESULT);
  });

  it("delegates parsed JSON bodies to the detail service with auth scope", async () => {
    mockEmailDetailService.updateEmail.mockResolvedValueOnce({
      object: "email",
      id: "email-uuid",
    });

    const { PATCH } = await import("@/app/api/emails/[id]/route");
    const res = await PATCH(
      new Request("http://localhost:3015/api/emails/email-uuid", {
        method: "PATCH",
        headers: { Authorization: "Bearer os_test123" },
        body: JSON.stringify({ scheduled_at: "2026-05-08T00:00:00.000Z" }),
      }),
      { params: Promise.resolve({ id: "email-uuid" }) },
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      object: "email",
      id: "email-uuid",
    });
    expect(mockEmailDetailService.updateEmail).toHaveBeenCalledWith({
      userId: AUTH_RESULT.userId,
      id: "email-uuid",
      body: { scheduled_at: "2026-05-08T00:00:00.000Z" },
    });
  });

  it("returns 400 for invalid JSON before calling the service", async () => {
    const { PATCH } = await import("@/app/api/emails/[id]/route");
    const res = await PATCH(
      new Request("http://localhost:3015/api/emails/email-uuid", {
        method: "PATCH",
        headers: { Authorization: "Bearer os_test123" },
        body: "{invalid",
      }),
      { params: Promise.resolve({ id: "email-uuid" }) },
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "Invalid JSON body" });
    expect(mockEmailDetailService.updateEmail).not.toHaveBeenCalled();
  });

  it("maps detail service update errors to legacy responses", async () => {
    const { PATCH } = await import("@/app/api/emails/[id]/route");

    for (const [error, status, expected] of [
      [
        new MockEmailDetailServiceError("not_found", "Email not found"),
        404,
        { error: "Email not found" },
      ],
      [
        new MockEmailDetailServiceError(
          "invalid_state",
          "Cannot update a delivered email",
        ),
        400,
        { error: "Cannot update a delivered email" },
      ],
      [
        new MockEmailDetailServiceError("no_fields", "No fields to update"),
        400,
        { error: "No fields to update" },
      ],
    ] as const) {
      mockEmailDetailService.updateEmail.mockRejectedValueOnce(error);
      const res = await PATCH(
        new Request("http://localhost:3015/api/emails/email-uuid", {
          method: "PATCH",
          headers: { Authorization: "Bearer os_test123" },
          body: JSON.stringify({ scheduled_at: null }),
        }),
        { params: Promise.resolve({ id: "email-uuid" }) },
      );
      expect(res.status).toBe(status);
      await expect(res.json()).resolves.toEqual(expected);
    }
  });

  it("maps invalid scheduled_at service errors to the existing validation envelope", async () => {
    mockEmailDetailService.updateEmail.mockRejectedValueOnce(
      new MockEmailDetailServiceError(
        "invalid_scheduled_at",
        "Invalid scheduled_at",
      ),
    );

    const { PATCH } = await import("@/app/api/emails/[id]/route");
    const res = await PATCH(
      new Request("http://localhost:3015/api/emails/email-uuid", {
        method: "PATCH",
        headers: { Authorization: "Bearer os_test123" },
        body: JSON.stringify([]),
      }),
      { params: Promise.resolve({ id: "email-uuid" }) },
    );

    expect(res.status).toBe(422);
    await expect(res.json()).resolves.toMatchObject({
      name: "validation_error",
      details: {
        fieldErrors: {
          scheduled_at: [expect.stringContaining("future ISO 8601")],
        },
      },
    });
  });
});

describe("DELETE /api/emails", () => {
  beforeEach(() => {
    vi.resetModules();
    mockEmailReadService.deleteEmail.mockReset();
    mockValidateApiKey.mockResolvedValue(AUTH_RESULT);
  });

  it("scopes deletes to the authenticated user", async () => {
    mockEmailReadService.deleteEmail.mockResolvedValueOnce({ success: true });

    const { DELETE } = await import("@/app/api/emails/route");
    const res = await DELETE(
      new Request("http://localhost:3015/api/emails?id=email-uuid", {
        method: "DELETE",
        headers: { Authorization: "Bearer os_test123" },
      }),
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ success: true });
    expect(mockEmailReadService.deleteEmail).toHaveBeenCalledWith(
      AUTH_RESULT.userId,
      "email-uuid",
    );
  });
});

describe("GET /api/emails/:id/attachments", () => {
  beforeEach(() => {
    vi.resetModules();
    mockEmailLifecycleService.listAttachments.mockReset();
    mockEmailLifecycleService.getAttachment.mockReset();
    mockValidateApiKey.mockResolvedValue(AUTH_RESULT);
  });

  it("returns the service attachment list response unchanged", async () => {
    mockEmailLifecycleService.listAttachments.mockResolvedValueOnce({
      object: "list",
      data: [
        {
          id: "att-0",
          filename: "receipt.txt",
          content_type: "application/octet-stream",
        },
      ],
    });

    const { GET } = await import("@/app/api/emails/[id]/attachments/route");
    const res = await GET(
      new Request("http://localhost:3015/api/emails/email-uuid/attachments", {
        headers: { Authorization: "Bearer os_test123" },
      }) as never,
      { params: Promise.resolve({ id: "email-uuid" }) },
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      object: "list",
      data: [
        {
          id: "att-0",
          filename: "receipt.txt",
          content_type: "application/octet-stream",
        },
      ],
    });
    expect(mockEmailLifecycleService.listAttachments).toHaveBeenCalledWith(
      AUTH_RESULT.userId,
      "email-uuid",
    );
  });

  it("preserves the list route email-not-found response", async () => {
    mockEmailLifecycleService.listAttachments.mockRejectedValueOnce(
      new MockEmailLifecycleServiceError("email_not_found", "Email not found"),
    );

    const { GET } = await import("@/app/api/emails/[id]/attachments/route");
    const res = await GET(
      new Request("http://localhost:3015/api/emails/email-uuid/attachments", {
        headers: { Authorization: "Bearer os_test123" },
      }) as never,
      { params: Promise.resolve({ id: "email-uuid" }) },
    );

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ error: "Email not found" });
  });

  it("preserves the detail route attachment-not-found response", async () => {
    mockEmailLifecycleService.getAttachment.mockRejectedValueOnce(
      new MockEmailLifecycleServiceError(
        "attachment_not_found",
        "Attachment not found",
      ),
    );

    const { GET } = await import(
      "@/app/api/emails/[id]/attachments/[attachmentId]/route"
    );
    const res = await GET(
      new Request(
        "http://localhost:3015/api/emails/email-uuid/attachments/missing",
        {
          headers: { Authorization: "Bearer os_test123" },
        },
      ) as never,
      {
        params: Promise.resolve({
          id: "email-uuid",
          attachmentId: "missing",
        }),
      },
    );

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({
      error: "Attachment not found",
    });
    expect(mockEmailLifecycleService.getAttachment).toHaveBeenCalledWith(
      AUTH_RESULT.userId,
      "email-uuid",
      "missing",
    );
  });
});

describe("POST /api/emails/:id/cancel", () => {
  beforeEach(() => {
    vi.resetModules();
    mockEmailLifecycleService.cancelEmail.mockReset();
    mockValidateApiKey.mockResolvedValue(AUTH_RESULT);
  });

  it("returns the canceled email response from the lifecycle service", async () => {
    mockEmailLifecycleService.cancelEmail.mockResolvedValueOnce({
      object: "email",
      id: "email-uuid",
      status: "canceled",
    });

    const { POST } = await import("@/app/api/emails/[id]/cancel/route");
    const res = await POST(
      new Request("http://localhost:3015/api/emails/email-uuid/cancel", {
        method: "POST",
        headers: { Authorization: "Bearer os_test123" },
      }) as never,
      { params: Promise.resolve({ id: "email-uuid" }) },
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      object: "email",
      id: "email-uuid",
      status: "canceled",
    });
    expect(mockEmailLifecycleService.cancelEmail).toHaveBeenCalledWith(
      AUTH_RESULT.userId,
      "email-uuid",
    );
  });

  it("preserves the non-scheduled cancel response", async () => {
    mockEmailLifecycleService.cancelEmail.mockRejectedValueOnce(
      new MockEmailLifecycleServiceError(
        "invalid_state",
        "Cannot cancel a delivered email",
      ),
    );

    const { POST } = await import("@/app/api/emails/[id]/cancel/route");
    const res = await POST(
      new Request("http://localhost:3015/api/emails/email-uuid/cancel", {
        method: "POST",
        headers: { Authorization: "Bearer os_test123" },
      }) as never,
      { params: Promise.resolve({ id: "email-uuid" }) },
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      error: "Cannot cancel a delivered email",
    });
  });
});

describe("POST /emails/:email_id/cancel", () => {
  beforeEach(() => {
    vi.resetModules();
    mockEmailLifecycleService.cancelEmail.mockReset();
    mockValidateApiKey.mockResolvedValue(AUTH_RESULT);
  });

  it("delegates to the scheduled-email cancel route and returns the Resend-compatible success body", async () => {
    mockEmailLifecycleService.cancelEmail.mockResolvedValueOnce({
      object: "email",
      id: "email-uuid",
      status: "canceled",
    });

    const { POST } = await import("@/app/emails/[id]/cancel/route");
    const res = await POST(
      new Request("http://localhost:3015/emails/email-uuid/cancel", {
        method: "POST",
        headers: { Authorization: "Bearer os_test123" },
      }) as never,
      { params: Promise.resolve({ id: "email-uuid" }) },
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      object: "email",
      id: "email-uuid",
    });
    expect(mockEmailLifecycleService.cancelEmail).toHaveBeenCalledWith(
      AUTH_RESULT.userId,
      "email-uuid",
    );
  });

  it("uses the same API-key auth boundary as the internal cancel route", async () => {
    mockValidateApiKey.mockResolvedValueOnce(null);

    const { POST } = await import("@/app/emails/[id]/cancel/route");
    const res = await POST(
      new Request("http://localhost:3015/emails/email-uuid/cancel", {
        method: "POST",
      }) as never,
      { params: Promise.resolve({ id: "email-uuid" }) },
    );

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({
      error: "Missing or invalid API key",
    });
    expect(mockEmailLifecycleService.cancelEmail).not.toHaveBeenCalled();
  });

  it("preserves invalid-state behavior for non-scheduled emails", async () => {
    mockEmailLifecycleService.cancelEmail.mockRejectedValueOnce(
      new MockEmailLifecycleServiceError(
        "invalid_state",
        "Cannot cancel a delivered email",
      ),
    );

    const { POST } = await import("@/app/emails/[id]/cancel/route");
    const res = await POST(
      new Request("http://localhost:3015/emails/email-uuid/cancel", {
        method: "POST",
        headers: { Authorization: "Bearer os_test123" },
      }) as never,
      { params: Promise.resolve({ id: "email-uuid" }) },
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      error: "Cannot cancel a delivered email",
    });
  });

  it("preserves tenant-scoped not-found behavior from the delegated service", async () => {
    mockEmailLifecycleService.cancelEmail.mockRejectedValueOnce(
      new MockEmailLifecycleServiceError("email_not_found", "Email not found"),
    );

    const { POST } = await import("@/app/emails/[id]/cancel/route");
    const res = await POST(
      new Request("http://localhost:3015/emails/other-tenant-email/cancel", {
        method: "POST",
        headers: { Authorization: "Bearer os_test123" },
      }) as never,
      { params: Promise.resolve({ id: "other-tenant-email" }) },
    );

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ error: "Email not found" });
    expect(mockEmailLifecycleService.cancelEmail).toHaveBeenCalledWith(
      AUTH_RESULT.userId,
      "other-tenant-email",
    );
  });
});

describe("GET /api/emails/:id/events", () => {
  beforeEach(() => {
    vi.resetModules();
    mockEmailLifecycleService.listEvents.mockReset();
    mockValidateApiKey.mockResolvedValue(AUTH_RESULT);
  });

  it("does not list events for an email outside the authenticated user scope", async () => {
    mockEmailLifecycleService.listEvents.mockRejectedValueOnce(
      new MockEmailLifecycleServiceError("email_not_found", "Email not found"),
    );

    const { GET } = await import("@/app/api/emails/[id]/events/route");
    const res = await GET(
      new Request("http://localhost:3015/api/emails/email-uuid/events", {
        headers: { Authorization: "Bearer os_test123" },
      }) as never,
      { params: Promise.resolve({ id: "email-uuid" }) },
    );

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ error: "Email not found" });
    expect(mockEmailLifecycleService.listEvents).toHaveBeenCalledWith(
      AUTH_RESULT.userId,
      "email-uuid",
    );
  });

  it("returns ordered event DTOs from the lifecycle service unchanged", async () => {
    mockEmailLifecycleService.listEvents.mockResolvedValueOnce({
      object: "list",
      data: [
        {
          object: "email_event",
          id: "event-1",
          type: "queued",
          payload: { message: "queued" },
          created_at: new Date("2026-05-01T00:00:00.000Z"),
        },
      ],
    });

    const { GET } = await import("@/app/api/emails/[id]/events/route");
    const res = await GET(
      new Request("http://localhost:3015/api/emails/email-uuid/events", {
        headers: { Authorization: "Bearer os_test123" },
      }) as never,
      { params: Promise.resolve({ id: "email-uuid" }) },
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      object: "list",
      data: [
        {
          object: "email_event",
          id: "event-1",
          type: "queued",
          payload: { message: "queued" },
          created_at: "2026-05-01T00:00:00.000Z",
        },
      ],
    });
  });
});

describe("API key sending permissions", () => {
  beforeEach(() => {
    vi.resetModules();
    mockPublishBackgroundJob.mockReset();
    mockPublishBackgroundJob.mockResolvedValue({
      status: "skipped",
      reason: "queue_url_missing",
    });
    mockReserveEmailQuota.mockResolvedValue({ ok: true, bypassed: true });
    mockReleaseEmailQuota.mockResolvedValue(undefined);
    mockGetApiKeyAuthHeaderError.mockReturnValue(null);
    Object.assign(mockDb.query, {
      emails: { findFirst: vi.fn().mockResolvedValue(null) },
      contacts: { findFirst: vi.fn().mockResolvedValue(null) },
      domains: {
        findFirst: vi.fn().mockResolvedValue({ name: "example.com" }),
      },
    });
    mockDb.select = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    });
    mockDb.transaction.mockImplementation(
      async (callback: (tx: typeof mockDb) => unknown) => callback(mockDb),
    );
  });

  it("allows sending-access API keys to send email", async () => {
    mockValidateApiKey.mockResolvedValue({
      ...AUTH_RESULT,
      permission: "sending_access",
      domain: null,
    });
    const valuesMock = vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([{ id: "email-sending-key" }]),
    });
    mockDb.insert = vi.fn().mockReturnValue({ values: valuesMock });

    const { POST } = await import("@/app/api/emails/route");
    const res = await POST(
      makeRequest(
        "POST",
        {
          from: "sender@example.com",
          to: ["user@test.com"],
          subject: "Allowed",
          html: "<p>Hello</p>",
        },
        { Authorization: "Bearer os_sending" },
      ),
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ id: "email-sending-key" });
  });

  it("rejects domain-restricted sending keys from other from domains", async () => {
    mockValidateApiKey.mockResolvedValue({
      ...AUTH_RESULT,
      permission: "sending_access",
      domain: "example.com",
    });
    const insertMock = vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    });
    mockDb.insert = insertMock;

    const { POST } = await import("@/app/api/emails/route");
    const res = await POST(
      makeRequest(
        "POST",
        {
          from: "sender@other.com",
          to: ["user@test.com"],
          subject: "Blocked",
          html: "<p>Hello</p>",
        },
        { Authorization: "Bearer os_sending" },
      ),
    );

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toMatchObject({
      code: "api_key_domain_restricted",
      statusCode: 403,
      details: { restrictedDomain: "example.com", fromDomain: "other.com" },
    });
    expect(nonLogInsertCalls()).toHaveLength(0);
  });
});
