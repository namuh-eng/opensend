import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  LogReadServiceError as ActualLogReadServiceError,
  type LogRepository,
  createLogReadService as createActualLogReadService,
} from "../packages/core/src/services/logs";

const mockValidateApiKey = vi.hoisted(() => vi.fn());
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

vi.mock("@/lib/api-auth", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/api-auth")>("@/lib/api-auth");
  return {
    validateApiKey: mockValidateApiKey,
    unauthorizedResponse: actual.unauthorizedResponse,
  };
});

vi.mock("@opensend/core", () => ({
  createLogReadService: mockCreateLogReadService,
  LogReadServiceError: MockLogReadServiceError,
}));

const createdAt = new Date("2026-05-06T00:00:00.000Z");
const detailCreatedAt = new Date("2026-05-06T01:00:00.000Z");

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

describe("log read service", () => {
  it("normalizes filters, preserves cursor aliases, and scopes list queries to the caller", async () => {
    const calls: Parameters<LogRepository["listForApi"]>[0][] = [];
    const repository: LogRepository = {
      async listForApi(options) {
        calls.push(options);
        return {
          data: [
            {
              id: "log-1",
              method: "POST",
              endpoint: "/api/emails",
              status: 200,
              userAgent: "opensend-test",
              apiKeyId: "api-key-a",
              createdAt,
            },
          ],
          hasMore: true,
        };
      },
      async findByIdForUser() {
        return undefined;
      },
    };
    const service = createActualLogReadService({ repository });

    const response = await service.listLogs({
      userId: "user-a",
      limit: 500,
      status: "200",
      method: "post",
      apiKeyId: "api-key-a",
      after: "log-z",
      before: "log-0",
      dateFrom: "2026-05-01",
      dateTo: "2026-05-06",
      userAgent: "test",
      search: "  email-1  ",
    });

    expect(response).toEqual({
      object: "list",
      data: [
        {
          id: "log-1",
          method: "POST",
          endpoint: "/api/emails",
          response_status: 200,
          user_agent: "opensend-test",
          api_key_id: "api-key-a",
          created_at: createdAt,
        },
      ],
      has_more: true,
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      userId: "user-a",
      limit: 100,
      status: 200,
      method: "POST",
      apiKeyId: "api-key-a",
      after: "log-z",
      before: "log-0",
      userAgent: "test",
      search: "email-1",
    });
    expect(calls[0].dateFrom).toBeInstanceOf(Date);
    expect(calls[0].dateTo).toBeInstanceOf(Date);
    expect(calls[0].dateTo?.getHours()).toBe(23);
    expect(calls[0].dateTo?.getMinutes()).toBe(59);
  });

  it("returns log detail DTOs with request and response bodies", async () => {
    const repository: LogRepository = {
      async listForApi() {
        return { data: [], hasMore: false };
      },
      async findByIdForUser(id, userId) {
        expect(id).toBe("log-1");
        expect(userId).toBe("user-a");
        return {
          id: "log-1",
          method: "GET",
          endpoint: "/api/logs/log-1",
          status: 200,
          userAgent: "opensend-test",
          requestBody: { query: "test" },
          responseBody: { ok: true },
          createdAt: detailCreatedAt,
          document: { trace: "trace-1" },
          userId: "user-a",
          apiKeyId: "api-key-a",
        };
      },
    };
    const service = createActualLogReadService({ repository });

    await expect(service.getLog("user-a", "log-1")).resolves.toEqual({
      object: "log",
      id: "log-1",
      method: "GET",
      endpoint: "/api/logs/log-1",
      status: 200,
      user_agent: "opensend-test",
      api_key_id: "api-key-a",
      request_body: { query: "test" },
      response_body: { ok: true },
      created_at: detailCreatedAt,
    });
  });

  it("raises a typed not-found error for cross-tenant or missing log detail", async () => {
    const repository: LogRepository = {
      async listForApi() {
        return { data: [], hasMore: false };
      },
      async findByIdForUser() {
        return undefined;
      },
    };
    const service = createActualLogReadService({ repository });

    await expect(service.getLog("user-a", "log-b")).rejects.toMatchObject({
      code: "not_found",
      message: "Log not found",
    });
    await expect(service.getLog("user-a", "log-b")).rejects.toBeInstanceOf(
      ActualLogReadServiceError,
    );
  });
});

describe("/api/logs routes", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockValidateApiKey.mockResolvedValue(fullAccessAuth());
    mockCreateLogReadService.mockReturnValue({
      listLogs: mockListLogs,
      getLog: mockGetLog,
    });
  });

  it("lists logs through the service with compatible aliases", async () => {
    mockListLogs.mockResolvedValue({
      object: "list",
      data: [
        {
          id: "log-1",
          method: "POST",
          endpoint: "/api/emails",
          response_status: 200,
          user_agent: "opensend-test",
          api_key_id: "api-key-a",
          created_at: createdAt,
        },
      ],
      has_more: false,
    });

    const { GET } = await import("@/app/api/logs/route");
    const res = await GET(
      request(
        "http://localhost:3015/api/logs?q=email-1&user_agent=test&date_from=2026-05-01&date_to=2026-05-06&api_key_id=api-key-a&after=log-z&before=log-0&method=post&status=200&limit=50",
      ),
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      object: "list",
      data: [
        {
          id: "log-1",
          method: "POST",
          endpoint: "/api/emails",
          response_status: 200,
          user_agent: "opensend-test",
          api_key_id: "api-key-a",
          created_at: createdAt.toISOString(),
        },
      ],
      has_more: false,
    });
    expect(mockListLogs).toHaveBeenCalledWith({
      userId: "user-a",
      limit: 50,
      status: "200",
      method: "post",
      apiKeyId: "api-key-a",
      after: "log-z",
      before: "log-0",
      dateFrom: "2026-05-01",
      dateTo: "2026-05-06",
      userAgent: "test",
      search: "email-1",
    });
  });

  it("supports camelCase and created date aliases", async () => {
    mockListLogs.mockResolvedValue({
      object: "list",
      data: [],
      has_more: false,
    });

    const { GET } = await import("@/app/api/logs/route");
    const res = await GET(
      request(
        "http://localhost:3015/api/logs?apiKeyId=api-key-a&userAgent=agent&search=needle&created_after=2026-05-01&created_before=2026-05-06",
      ),
    );

    expect(res.status).toBe(200);
    expect(mockListLogs).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKeyId: "api-key-a",
        userAgent: "agent",
        search: "needle",
        dateFrom: "2026-05-01",
        dateTo: "2026-05-06",
      }),
    );
  });

  it("requires full-access API keys for log reads", async () => {
    mockValidateApiKey.mockResolvedValue({
      ...fullAccessAuth(),
      permission: "sending_access",
    });

    const { GET } = await import("@/app/api/logs/route");
    const res = await GET(request("http://localhost:3015/api/logs"));

    expect(res.status).toBe(403);
    expect(mockListLogs).not.toHaveBeenCalled();
  });

  it("returns 404 for another tenant's log detail", async () => {
    mockGetLog.mockRejectedValue(
      new MockLogReadServiceError("not_found", "Log not found"),
    );

    const { GET } = await import("@/app/api/logs/[id]/route");
    const res = await GET(request("http://localhost:3015/api/logs/log-b"), {
      params: Promise.resolve({ id: "log-b" }),
    });

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ error: "Log not found" });
    expect(mockGetLog).toHaveBeenCalledWith("user-a", "log-b");
  });
});
