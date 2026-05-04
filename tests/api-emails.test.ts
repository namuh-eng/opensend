import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocks ─────────────────────────────────────────────────────────

const mockSendEmail = vi.hoisted(() => vi.fn());
const mockPublishBackgroundJob = vi.hoisted(() => vi.fn());
const mockValidateApiKey = vi.hoisted(() => vi.fn());
const mockGetApiKeyAuthHeaderError = vi.hoisted(() => vi.fn());
const mockEmitCloudWatchMetric = vi.hoisted(() => vi.fn());
const mockLogTelemetry = vi.hoisted(() => vi.fn());
const mockRecordTelemetryError = vi.hoisted(() => vi.fn());
const mockReserveEmailQuota = vi.hoisted(() => vi.fn());
const mockDb = vi.hoisted(() => ({
  insert: vi.fn(),
  select: vi.fn(),
  query: vi.fn(),
  transaction: vi.fn(async (callback: (tx: typeof mockDb) => unknown) =>
    callback(mockDb),
  ),
}));

vi.mock("@/lib/ses", () => ({
  sendEmail: mockSendEmail,
}));

vi.mock("@opensend/core", () => {
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
    createBackgroundJob: (job: Record<string, unknown>) => ({
      ...job,
      requestedAt: "2026-04-28T00:00:00.000Z",
    }),
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
    mockLogTelemetry.mockReset();
    mockRecordTelemetryError.mockReset();
    mockReserveEmailQuota.mockReset();
    mockReserveEmailQuota.mockResolvedValue({ ok: true, bypassed: true });
    mockGetApiKeyAuthHeaderError.mockReturnValue(null);
    Object.assign(mockDb.query, {
      emails: { findFirst: vi.fn().mockResolvedValue(null) },
      contacts: { findFirst: vi.fn().mockResolvedValue(null) },
    });
    mockDb.insert = vi.fn();
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
    vi.restoreAllMocks();
  });

  it("returns 422 with flattened validation details when required fields are missing", async () => {
    const { POST } = await import("@/app/api/emails/route");
    const req = makeRequest(
      "POST",
      { from: "test@domain.com" },
      { Authorization: "Bearer re_test123" },
    );
    const res = await POST(req);
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json).toEqual({
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
        Authorization: "Bearer re_test123",
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
      { Authorization: "Bearer re_test123" },
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
        Authorization: "Bearer re_test123",
        "x-correlation-id": "corr-email-test",
        traceparent,
      },
    );
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("x-correlation-id")).toBe("corr-email-test");
    expect(res.headers.get("traceparent")).toBe(traceparent);
    const json = await res.json();
    expect(json).toHaveProperty("id", emailId);
    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(valuesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "queued",
      }),
    );
    expect(valuesMock.mock.calls[0][0]).not.toHaveProperty("sentAt");
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
        { Authorization: "Bearer re_test123" },
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
      { Authorization: "Bearer re_test123" },
    );
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(mockPublishBackgroundJob).toHaveBeenCalledOnce();
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
      { Authorization: "Bearer re_test123" },
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
          { filename: "remote.txt", path: "https://example.com/file.txt" },
        ],
      },
      { Authorization: "Bearer re_test123" },
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
            filename: "remote.txt",
            path: "https://example.com/file.txt",
          }),
        ],
      }),
    );
  });
});

// ── POST /api/emails/batch Tests ──────────────────────────────────

describe("POST /api/emails/batch", () => {
  beforeEach(() => {
    vi.resetModules();
    mockSendEmail.mockReset();
    mockPublishBackgroundJob.mockReset();
    mockEmitCloudWatchMetric.mockReset();
    mockLogTelemetry.mockReset();
    mockRecordTelemetryError.mockReset();
    mockReserveEmailQuota.mockReset();
    mockReserveEmailQuota.mockResolvedValue({ ok: true, bypassed: true });
    mockGetApiKeyAuthHeaderError.mockReturnValue(null);
    Object.assign(mockDb.query, {
      emails: { findFirst: vi.fn().mockResolvedValue(null) },
      contacts: { findFirst: vi.fn().mockResolvedValue(null) },
    });
    mockDb.insert = vi.fn();
    mockDb.transaction.mockImplementation(
      async (callback: (tx: typeof mockDb) => unknown) => callback(mockDb),
    );
    mockPublishBackgroundJob.mockResolvedValue({
      status: "skipped",
      reason: "queue_url_missing",
    });
    mockValidateApiKey.mockResolvedValue(AUTH_RESULT);
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
      Authorization: "Bearer re_test123",
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
        Authorization: "Bearer re_test123",
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
        Authorization: "Bearer re_test123",
        "Idempotency-Key": "x".repeat(256),
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

  it("short-circuits duplicate batch Idempotency-Key retries before quota, rows, or queue", async () => {
    const findFirst = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "email-1" });
    Object.assign(mockDb.query, {
      emails: { findFirst },
      contacts: { findFirst: vi.fn().mockResolvedValue(null) },
    });

    let callCount = 0;
    const valuesMock = vi.fn().mockImplementation(() => ({
      returning: vi.fn().mockResolvedValue([{ id: `email-${++callCount}` }]),
    }));
    mockDb.insert = vi.fn().mockReturnValue({ values: valuesMock });

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

    const first = await POST(
      makeRequest("POST", emailsArr, {
        Authorization: "Bearer re_test123",
        "Idempotency-Key": "batch-key-1",
      }),
    );
    const retry = await POST(
      makeRequest("POST", emailsArr, {
        Authorization: "Bearer re_test123",
        "Idempotency-Key": "batch-key-1",
      }),
    );

    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({
      data: [{ id: "email-1" }, { id: "email-2" }],
    });
    expect(retry.status).toBe(409);
    await expect(retry.json()).resolves.toMatchObject({
      name: "idempotency_conflict",
      code: "idempotency_conflict",
      statusCode: 409,
      details: { id: "email-1" },
    });

    expect(mockReserveEmailQuota).toHaveBeenCalledTimes(1);
    expect(mockDb.insert).toHaveBeenCalledTimes(2);
    expect(mockPublishBackgroundJob).toHaveBeenCalledTimes(2);
    expect(
      valuesMock.mock.calls.map(([value]) => value.idempotencyKey),
    ).toEqual(["batch-key-1", null]);
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
      { Authorization: "Bearer re_test123" },
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
      Authorization: "Bearer re_test123",
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
});

// ── GET /api/emails Tests ─────────────────────────────────────────

describe("GET /api/emails", () => {
  beforeEach(() => {
    vi.resetModules();
    mockValidateApiKey.mockResolvedValue(AUTH_RESULT);
  });

  it("returns paginated list of emails", async () => {
    const mockEmails = [
      {
        id: "email-1",
        from: "sender@domain.com",
        to: ["user@test.com"],
        subject: "Test",
        createdAt: new Date("2024-01-01"),
        status: "delivered",
        cc: null,
        bcc: null,
        replyTo: null,
        scheduledAt: null,
        sentAt: new Date("2024-01-01T00:00:05Z"),
      },
    ];

    const mockLimit = vi.fn().mockResolvedValue(mockEmails);
    const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimit });
    const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
    const mockFrom = vi.fn().mockReturnValue({
      orderBy: mockOrderBy,
      where: mockWhere,
    });
    mockDb.select = vi.fn().mockReturnValue({ from: mockFrom });

    const { GET } = await import("@/app/api/emails/route");
    const req = new Request("http://localhost:3015/api/emails?limit=20", {
      headers: { Authorization: "Bearer re_test123" },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveProperty("object", "list");
    expect(json).toHaveProperty("data");
    expect(Array.isArray(json.data)).toBe(true);
    expect(json.data[0]).toHaveProperty("sent_at", "2024-01-01T00:00:05.000Z");
  });

  it("applies status filter so queued dashboard/API views return queued rows", async () => {
    const mockLimit = vi.fn().mockResolvedValue([]);
    const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimit });
    const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
    const mockFrom = vi.fn().mockReturnValue({
      orderBy: mockOrderBy,
      where: mockWhere,
    });
    mockDb.select = vi.fn().mockReturnValue({ from: mockFrom });

    const { GET } = await import("@/app/api/emails/route");
    const req = new Request("http://localhost:3015/api/emails?status=queued", {
      headers: { Authorization: "Bearer re_test123" },
    });

    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(mockWhere).toHaveBeenCalledWith(
      expect.objectContaining({
        op: "and",
        args: [
          expect.objectContaining({
            op: "eq",
            args: expect.arrayContaining(["queued"]),
          }),
        ],
      }),
    );
  });
});

// ── GET /api/emails/:id Tests ─────────────────────────────────────

describe("GET /api/emails/:id", () => {
  beforeEach(() => {
    vi.resetModules();
    mockValidateApiKey.mockResolvedValue(AUTH_RESULT);
  });

  it("returns email with events", async () => {
    const mockEmail = {
      id: "email-uuid",
      from: "sender@domain.com",
      to: ["user@test.com"],
      subject: "Test",
      html: "<p>Hello</p>",
      text: null,
      cc: null,
      bcc: null,
      replyTo: null,
      status: "delivered",
      scheduledAt: null,
      sentAt: new Date("2024-01-01T00:00:05Z"),
      tags: null,
      createdAt: new Date("2024-01-01"),
      events: [
        {
          type: "sent",
          timestamp: new Date("2024-01-01"),
          data: null,
        },
      ],
    };

    mockDb.query = {
      emails: {
        findFirst: vi.fn().mockResolvedValue(mockEmail),
      },
    } as unknown as ReturnType<typeof vi.fn>;

    const { GET } = await import("@/app/api/emails/[id]/route");
    const req = new Request("http://localhost:3015/api/emails/email-uuid", {
      headers: { Authorization: "Bearer re_test123" },
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
  });

  it("returns 404 for non-existent email", async () => {
    mockDb.query = {
      emails: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    } as unknown as ReturnType<typeof vi.fn>;

    const { GET } = await import("@/app/api/emails/[id]/route");
    const req = new Request("http://localhost:3015/api/emails/nonexistent", {
      headers: { Authorization: "Bearer re_test123" },
    });
    const res = await GET(req, {
      params: Promise.resolve({ id: "nonexistent" }),
    });
    expect(res.status).toBe(404);
  });
});
