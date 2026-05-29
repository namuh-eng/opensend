import { beforeEach, describe, expect, it, vi } from "vitest";

const mockValidateApiKey = vi.hoisted(() => vi.fn());
const mockCreateEmailTraceService = vi.hoisted(() => vi.fn());
const mockGetTrace = vi.hoisted(() => vi.fn());
const MockEmailTraceServiceError = vi.hoisted(
  () =>
    class EmailTraceServiceError extends Error {
      constructor(
        readonly code: "email_not_found",
        message: string,
      ) {
        super(message);
        this.name = "EmailTraceServiceError";
      }
    },
);

vi.mock("@/lib/api-auth", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/api-auth")>("@/lib/api-auth");
  return {
    validateApiKey: mockValidateApiKey,
    unauthorizedResponse: actual.unauthorizedResponse,
  };
});

vi.mock("@opensend/core", () => ({
  createEmailTraceService: mockCreateEmailTraceService,
  EmailTraceServiceError: MockEmailTraceServiceError,
}));

function request(url: string) {
  return new Request(url, {
    headers: { Authorization: "Bearer os_test" },
  });
}

function fullAccessAuth() {
  return {
    apiKeyId: "api-key-a",
    permission: "full_access",
    domain: null,
    userId: "user-a",
  };
}

describe("/api/emails/[id]/trace route", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockValidateApiKey.mockResolvedValue(fullAccessAuth());
    mockCreateEmailTraceService.mockReturnValue({ getTrace: mockGetTrace });
    mockGetTrace.mockResolvedValue({
      object: "email_trace",
      email_id: "email-1",
      data: [
        {
          object: "email_trace_event",
          id: "email:email-1:created",
          source: "queue",
          type: "created",
          created_at: new Date("2026-05-01T00:00:00.000Z"),
          summary: "Email record created in queued state",
          details: { tags: ["campaign=launch"] },
          related_id: "email-1",
          related_url: "/emails/email-1",
        },
      ],
    });
  });

  it("returns the tenant-scoped trace envelope", async () => {
    const { GET } = await import("@/app/api/emails/[id]/trace/route");
    const res = await GET(
      request("http://localhost/api/emails/email-1/trace") as never,
      {
        params: Promise.resolve({ id: "email-1" }),
      } as never,
    );

    expect(res.status).toBe(200);
    expect(mockGetTrace).toHaveBeenCalledWith("user-a", "email-1");
    await expect(res.json()).resolves.toMatchObject({
      object: "email_trace",
      email_id: "email-1",
      data: [
        {
          source: "queue",
          type: "created",
          details: { tags: ["campaign=launch"] },
        },
      ],
    });
  });

  it("preserves full-access auth and cross-tenant not found behavior", async () => {
    mockValidateApiKey.mockResolvedValueOnce({
      ...fullAccessAuth(),
      permission: "sending_access",
    });
    const { GET } = await import("@/app/api/emails/[id]/trace/route");
    const forbidden = await GET(
      request("http://localhost/api/emails/email-1/trace") as never,
      { params: Promise.resolve({ id: "email-1" }) } as never,
    );
    expect(forbidden.status).toBe(403);

    mockValidateApiKey.mockResolvedValueOnce(fullAccessAuth());
    mockGetTrace.mockRejectedValueOnce(
      new MockEmailTraceServiceError("email_not_found", "Email not found"),
    );
    const missing = await GET(
      request("http://localhost/api/emails/email-2/trace") as never,
      {
        params: Promise.resolve({ id: "email-2" }),
      } as never,
    );
    expect(missing.status).toBe(404);
    await expect(missing.json()).resolves.toEqual({ error: "Email not found" });
  });
});
