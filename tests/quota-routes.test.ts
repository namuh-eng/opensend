import { beforeEach, describe, expect, it, vi } from "vitest";

const mockValidateApiKey = vi.hoisted(() => vi.fn());
const mockReserveEmailQuota = vi.hoisted(() => vi.fn());
const mockCheckDomainQuota = vi.hoisted(() => vi.fn());
const mockCheckApiKeyQuota = vi.hoisted(() => vi.fn());
const mockCreateDomainIdentity = vi.hoisted(() => vi.fn());
const mockDb = vi.hoisted(() => ({
  insert: vi.fn(),
  select: vi.fn(),
  transaction: vi.fn(async (callback: (tx: typeof mockDb) => unknown) =>
    callback(mockDb),
  ),
}));

vi.mock("@/lib/db", () => ({ db: mockDb }));
vi.mock("@/lib/api-auth", () => ({
  validateApiKey: mockValidateApiKey,
  getApiKeyAuthHeaderError: () => null,
  unauthorizedResponse: () =>
    Response.json({ error: "Missing or invalid API key" }, { status: 401 }),
}));
vi.mock("@/lib/billing/quota", () => ({
  reserveEmailQuota: mockReserveEmailQuota,
  checkDomainQuota: mockCheckDomainQuota,
  checkApiKeyQuota: mockCheckApiKeyQuota,
  releaseEmailQuota: vi.fn(),
  quotaExceededResponse: (info: {
    resource: string;
    limit: number;
    used: number;
    plan: string;
    upgrade_url: string;
  }) =>
    Response.json(
      {
        name: "quota_exceeded",
        code: "quota_exceeded",
        message: "Quota exceeded.",
        statusCode: 402,
        details: info,
      },
      { status: 402 },
    ),
}));
vi.mock("@/lib/ses", () => ({
  createDomainIdentity: mockCreateDomainIdentity,
}));
vi.mock("@/lib/domain-cache", () => ({
  invalidateDomainCaches: vi.fn(),
}));
vi.mock("@opensend/core", async () => {
  const actual =
    await vi.importActual<typeof import("@opensend/core")>("@opensend/core");
  return {
    ...actual,
    createTelemetryContext: () => ({
      correlationId: "corr-quota",
      traceparent: "00-11111111111111111111111111111111-2222222222222222-01",
    }),
    emitCloudWatchMetric: vi.fn(),
    logTelemetry: vi.fn(),
    recordTelemetryError: vi.fn(),
  };
});

const auth = {
  apiKeyId: "key-1",
  userId: "user-1",
  permission: "full_access",
  domainId: null,
};
const quotaInfo = {
  resource: "emails",
  limit: 3,
  used: 3,
  plan: "free",
  upgrade_url: "/dashboard/billing",
};

function jsonRequest(url: string, body: unknown): Request {
  return new Request(url, {
    method: "POST",
    headers: {
      Authorization: "Bearer re_test",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

describe("quota route gates", () => {
  beforeEach(() => {
    vi.resetModules();
    mockValidateApiKey.mockResolvedValue(auth);
    mockReserveEmailQuota.mockReset();
    mockCheckDomainQuota.mockReset();
    mockCheckApiKeyQuota.mockReset();
    mockCreateDomainIdentity.mockReset();
    mockDb.insert.mockReset();
    mockDb.select.mockReset();
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    });
    mockDb.transaction.mockImplementation(
      async (callback: (tx: typeof mockDb) => unknown) => callback(mockDb),
    );
  });

  it("returns 402 from POST /api/emails after payload validation and before insert", async () => {
    mockReserveEmailQuota.mockResolvedValue({ ok: false, info: quotaInfo });
    const { POST } = await import("@/app/api/emails/route");

    const res = await POST(
      jsonRequest("http://localhost:3015/api/emails", {
        from: "sender@example.com",
        to: ["user@example.com"],
        subject: "Quota",
        html: "<p>Quota</p>",
      }),
    );

    expect(res.status).toBe(402);
    await expect(res.json()).resolves.toMatchObject({
      name: "quota_exceeded",
      code: "quota_exceeded",
      message: "Quota exceeded.",
      statusCode: 402,
      details: {
        limit: 3,
        used: 3,
        plan: "free",
        upgrade_url: "/dashboard/billing",
      },
    });
    expect(mockReserveEmailQuota).toHaveBeenCalledWith(
      "user-1",
      1,
      expect.any(Date),
      process.env,
      mockDb,
    );
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it("returns 402 from POST /api/emails/batch when the batch would overrun quota", async () => {
    mockReserveEmailQuota.mockResolvedValue({ ok: false, info: quotaInfo });
    const { POST } = await import("@/app/api/emails/batch/route");

    const res = await POST(
      jsonRequest("http://localhost:3015/api/emails/batch", [
        {
          from: "sender@example.com",
          to: ["one@example.com"],
          subject: "One",
          html: "<p>One</p>",
        },
        {
          from: "sender@example.com",
          to: ["two@example.com"],
          subject: "Two",
          html: "<p>Two</p>",
        },
      ]),
    );

    expect(res.status).toBe(402);
    expect(mockReserveEmailQuota).toHaveBeenCalledWith(
      "user-1",
      2,
      expect.any(Date),
      process.env,
      mockDb,
    );
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it("returns 402 from POST /api/domains before creating an SES identity", async () => {
    mockCheckDomainQuota.mockResolvedValue({
      ok: false,
      info: { ...quotaInfo, resource: "domains", limit: 1, used: 1 },
    });
    const { POST } = await import("@/app/api/domains/route");

    const res = await POST(
      jsonRequest("http://localhost:3015/api/domains", {
        name: "example.com",
        region: "us-east-1",
      }),
    );

    expect(res.status).toBe(402);
    expect(mockCheckDomainQuota).toHaveBeenCalledWith("user-1");
    expect(mockCreateDomainIdentity).not.toHaveBeenCalled();
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it("returns 402 from POST /api/api-keys before inserting a key", async () => {
    mockCheckApiKeyQuota.mockResolvedValue({
      ok: false,
      info: { ...quotaInfo, resource: "api_keys", limit: 2, used: 2 },
    });
    const { POST } = await import("@/app/api/api-keys/route");

    const res = await POST(
      jsonRequest("http://localhost:3015/api/api-keys", { name: "extra" }),
    );

    expect(res.status).toBe(402);
    expect(mockCheckApiKeyQuota).toHaveBeenCalledWith("user-1");
    expect(mockDb.insert).not.toHaveBeenCalled();
  });
});
