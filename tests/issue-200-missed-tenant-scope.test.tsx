import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockValidateApiKey = vi.hoisted(() => vi.fn());
const mockGetServerSession = vi.hoisted(() => vi.fn());
const mockFindEmail = vi.hoisted(() => vi.fn());
const mockFindLog = vi.hoisted(() => vi.fn());
const mockUpdate = vi.hoisted(() => vi.fn());
const mockGetPresignedUrl = vi.hoisted(() => vi.fn());
const mockEmailLifecycleService = vi.hoisted(() => ({
  listAttachments: vi.fn(),
  getAttachment: vi.fn(),
  cancelEmail: vi.fn(),
}));
const mockCreateLogReadService = vi.hoisted(() => vi.fn());
const mockListLogs = vi.hoisted(() => vi.fn());
const mockGetLog = vi.hoisted(() => vi.fn());
const MockLogReadServiceError = vi.hoisted(
  () =>
    class LogReadServiceError extends Error {
      constructor(
        readonly code: "not_found",
        message: string,
      ) {
        super(message);
        this.name = "LogReadServiceError";
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
const mockRedirect = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
);

vi.mock("@/lib/api-auth", () => ({
  validateApiKey: mockValidateApiKey,
  getServerSession: mockGetServerSession,
  unauthorizedResponse: () =>
    Response.json({ error: "Missing or invalid API key" }, { status: 401 }),
}));

vi.mock("@/lib/db", () => ({
  db: {
    query: {
      emails: { findFirst: mockFindEmail },
      logs: { findFirst: mockFindLog },
    },
    update: mockUpdate,
  },
}));

vi.mock("@/lib/s3", () => ({
  getPresignedUrl: mockGetPresignedUrl,
}));

vi.mock("@opensend/core", () => ({
  createEmailLifecycleService: () => mockEmailLifecycleService,
  EmailLifecycleServiceError: MockEmailLifecycleServiceError,
  createLogReadService: mockCreateLogReadService,
  LogReadServiceError: MockLogReadServiceError,
}));

vi.mock("next/navigation", () => ({
  redirect: mockRedirect,
}));

const AUTH_RESULT = {
  apiKeyId: "key-b",
  permission: "full_access",
  domain: null,
  userId: "user-b",
};

function makeRequest(url: string, method = "GET"): NextRequest {
  return new Request(url, {
    method,
    headers: { Authorization: "Bearer os_user_b" },
  }) as unknown as NextRequest;
}

describe("issue #200 missed tenant isolation gaps", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockValidateApiKey.mockResolvedValue(AUTH_RESULT);
    mockGetServerSession.mockResolvedValue({ user: { id: "user-b" } });
    mockFindEmail.mockResolvedValue(null);
    mockFindLog.mockResolvedValue(null);
    mockGetPresignedUrl.mockResolvedValue("https://download.example/att-1");
    mockEmailLifecycleService.cancelEmail.mockReset();
    mockEmailLifecycleService.getAttachment.mockReset();
    mockEmailLifecycleService.listAttachments.mockReset();
    mockEmailLifecycleService.cancelEmail.mockRejectedValue(
      new MockEmailLifecycleServiceError("email_not_found", "Email not found"),
    );
    mockEmailLifecycleService.getAttachment.mockRejectedValue(
      new MockEmailLifecycleServiceError("email_not_found", "Email not found"),
    );
    mockEmailLifecycleService.listAttachments.mockRejectedValue(
      new MockEmailLifecycleServiceError("email_not_found", "Email not found"),
    );
    mockCreateLogReadService.mockReturnValue({
      listLogs: mockListLogs,
      getLog: mockGetLog,
    });
    mockListLogs.mockResolvedValue({
      object: "list",
      data: [],
      has_more: false,
    });
    mockGetLog.mockRejectedValue(
      new MockLogReadServiceError("not_found", "Log not found"),
    );
  });

  it("404s email cancel for another tenant and does not update", async () => {
    const { POST } = await import("@/app/api/emails/[id]/cancel/route");

    const response = await POST(
      makeRequest("http://localhost:3015/api/emails/email-a/cancel", "POST"),
      { params: Promise.resolve({ id: "email-a" }) },
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Email not found" });
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockEmailLifecycleService.cancelEmail).toHaveBeenCalledWith(
      AUTH_RESULT.userId,
      "email-a",
    );
  });

  it("404s email attachment list for another tenant", async () => {
    const { GET } = await import("@/app/api/emails/[id]/attachments/route");

    const response = await GET(
      makeRequest("http://localhost:3015/api/emails/email-a/attachments"),
      { params: Promise.resolve({ id: "email-a" }) },
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Email not found" });
    expect(mockEmailLifecycleService.listAttachments).toHaveBeenCalledWith(
      AUTH_RESULT.userId,
      "email-a",
    );
  });

  it("404s email attachment detail for another tenant without issuing a download URL", async () => {
    const { GET } = await import(
      "@/app/api/emails/[id]/attachments/[attachmentId]/route"
    );

    const response = await GET(
      makeRequest("http://localhost:3015/api/emails/email-a/attachments/att-1"),
      { params: Promise.resolve({ id: "email-a", attachmentId: "att-1" }) },
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Email not found" });
    expect(mockGetPresignedUrl).not.toHaveBeenCalled();
    expect(mockEmailLifecycleService.getAttachment).toHaveBeenCalledWith(
      AUTH_RESULT.userId,
      "email-a",
      "att-1",
    );
  });

  it("returns an empty public logs list when user-scoped predicates find no owned rows", async () => {
    const { GET } = await import("@/app/api/logs/route");

    const response = await GET(
      makeRequest("http://localhost:3015/api/logs?api_key_id=key-a"),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      object: "list",
      data: [],
      has_more: false,
    });
    expect(mockListLogs).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: AUTH_RESULT.userId,
        apiKeyId: "key-a",
      }),
    );
  });

  it("404s public log detail for another tenant", async () => {
    const { GET } = await import("@/app/api/logs/[id]/route");

    const response = await GET(
      makeRequest("http://localhost:3015/api/logs/log-a"),
      { params: Promise.resolve({ id: "log-a" }) },
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Log not found" });
    expect(mockGetLog).toHaveBeenCalledWith(AUTH_RESULT.userId, "log-a");
  });
});
