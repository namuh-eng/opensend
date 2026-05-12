import { beforeEach, describe, expect, it, vi } from "vitest";
import type { emailSuppressions } from "../packages/core/src/db/schema";
import {
  SuppressionServiceError as ActualSuppressionServiceError,
  type SuppressionRepository,
  createSuppressionService as createActualSuppressionService,
} from "../packages/core/src/services/suppressions";

const mockAuthorizeDashboardOrApiKey = vi.hoisted(() => vi.fn());
const mockGetServerSession = vi.hoisted(() => vi.fn());
const mockCreateSuppressionService = vi.hoisted(() => vi.fn());
const mockListSuppressions = vi.hoisted(() => vi.fn());
const mockDeleteSuppression = vi.hoisted(() => vi.fn());
const MockSuppressionServiceError = vi.hoisted(
  () =>
    class SuppressionServiceError extends Error {
      constructor(
        readonly code: "not_found",
        message: string,
      ) {
        super(message);
        this.name = "SuppressionServiceError";
      }
    },
);

vi.mock("@/lib/api-auth", () => ({
  authorizeDashboardOrApiKey: mockAuthorizeDashboardOrApiKey,
  getServerSession: mockGetServerSession,
  unauthorizedResponse: () =>
    Response.json({ error: "Missing or invalid API key" }, { status: 401 }),
}));

vi.mock("@opensend/core", () => ({
  createSuppressionService: mockCreateSuppressionService,
  SuppressionServiceError: MockSuppressionServiceError,
}));

const suppressedAt = new Date("2026-05-05T12:00:00.000Z");
const updatedAt = new Date("2026-05-05T12:30:00.000Z");

type SuppressionRow = typeof emailSuppressions.$inferSelect;

function suppressionRow(
  overrides: Partial<SuppressionRow> = {},
): SuppressionRow {
  return {
    id: "supp-1",
    userId: "user-1",
    email: "blocked@test.com",
    reason: "bounced",
    sourceEventId: "evt-1",
    sourceEmailId: "email-1",
    sourceMessageId: "msg-1",
    metadata: { source: "ses", bounceType: "Permanent" },
    suppressedAt,
    updatedAt,
    ...overrides,
  };
}

describe("suppression service", () => {
  it("lists user-scoped suppressions with public DTO shape and clamps limits", async () => {
    const calls: Parameters<SuppressionRepository["list"]>[0][] = [];
    const repository: SuppressionRepository = {
      async list(options) {
        calls.push(options);
        return {
          data: [suppressionRow()],
          hasMore: true,
        };
      },
      async removeForUser() {
        return [];
      },
    };

    const service = createActualSuppressionService({ repository });
    const response = await service.listSuppressions({
      userId: "user-1",
      limit: 500,
      after: "supp-0",
    });

    expect(calls).toEqual([{ userId: "user-1", limit: 100, after: "supp-0" }]);
    expect(response).toEqual({
      object: "list",
      scope: "user",
      data: [
        {
          id: "supp-1",
          object: "suppression",
          email: "blocked@test.com",
          reason: "bounced",
          scope: "user",
          source_event_id: "evt-1",
          source_email_id: "email-1",
          source_message_id: "msg-1",
          metadata: { source: "ses", bounceType: "Permanent" },
          suppressed_at: "2026-05-05T12:00:00.000Z",
          updated_at: "2026-05-05T12:30:00.000Z",
        },
      ],
      has_more: true,
    });

    await service.listSuppressions({ userId: "user-1", limit: -1 });
    await service.listSuppressions({ userId: "user-1", limit: Number.NaN });

    expect(calls.slice(1)).toEqual([
      { userId: "user-1", limit: 1, after: undefined },
      { userId: "user-1", limit: 50, after: undefined },
    ]);
  });

  it("deletes within caller scope and reports not_found when no row is removed", async () => {
    const calls: Array<{ userId: string; email: string }> = [];
    const repository: SuppressionRepository = {
      async list() {
        return { data: [], hasMore: false };
      },
      async removeForUser(userId, email) {
        calls.push({ userId, email });
        return calls.length === 1 ? [{ id: "supp-1" }] : [];
      },
    };

    const service = createActualSuppressionService({ repository });

    await expect(
      service.deleteSuppression("user-1", "Blocked@Test.com"),
    ).resolves.toEqual({ object: "suppression", deleted: true });

    let error: unknown;
    try {
      await service.deleteSuppression("user-2", "blocked@test.com");
    } catch (err) {
      error = err;
    }

    expect(error).toBeInstanceOf(ActualSuppressionServiceError);
    expect(error).toMatchObject({ code: "not_found" });

    expect(calls).toEqual([
      { userId: "user-1", email: "Blocked@Test.com" },
      { userId: "user-2", email: "blocked@test.com" },
    ]);
  });
});

describe("suppression management routes", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockCreateSuppressionService.mockReturnValue({
      listSuppressions: mockListSuppressions,
      deleteSuppression: mockDeleteSuppression,
    });
    mockAuthorizeDashboardOrApiKey.mockResolvedValue({
      apiKeyId: "key-1",
      permission: "full_access",
      domain: null,
      userId: "user-1",
    });
  });

  it("lists user-scoped suppression records through the core service", async () => {
    mockListSuppressions.mockResolvedValue({
      object: "list",
      scope: "user",
      data: [
        {
          id: "supp-1",
          object: "suppression",
          email: "blocked@test.com",
          reason: "bounced",
          scope: "user",
        },
      ],
      has_more: false,
    });

    const { GET } = await import("@/app/api/suppressions/route");
    const res = await GET(
      new Request(
        "http://localhost:3015/api/suppressions?limit=10&after=supp-0",
        {
          headers: { Authorization: "Bearer os_test" },
        },
      ),
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      object: "list",
      scope: "user",
      data: [
        {
          id: "supp-1",
          object: "suppression",
          email: "blocked@test.com",
          reason: "bounced",
          scope: "user",
        },
      ],
      has_more: false,
    });
    expect(mockListSuppressions).toHaveBeenCalledWith({
      userId: "user-1",
      limit: 10,
      after: "supp-0",
    });
  });

  it("resolves dashboard session users before listing suppressions", async () => {
    mockAuthorizeDashboardOrApiKey.mockResolvedValue({ dashboard: true });
    mockGetServerSession.mockResolvedValue({ user: { id: "dashboard-user" } });
    mockListSuppressions.mockResolvedValue({
      object: "list",
      scope: "user",
      data: [],
      has_more: false,
    });

    const { GET } = await import("@/app/api/suppressions/route");
    const res = await GET(
      new Request("http://localhost:3015/api/suppressions?limit=abc"),
    );

    expect(res.status).toBe(200);
    expect(mockListSuppressions).toHaveBeenCalledWith({
      userId: "dashboard-user",
      limit: Number.NaN,
      after: undefined,
    });
  });

  it("keeps unauthorized and API-key permission responses route-local", async () => {
    mockAuthorizeDashboardOrApiKey.mockResolvedValueOnce(null);

    const { GET } = await import("@/app/api/suppressions/route");
    const unauthorized = await GET(
      new Request("http://localhost:3015/api/suppressions"),
    );

    expect(unauthorized.status).toBe(401);
    await expect(unauthorized.json()).resolves.toEqual({
      error: "Missing or invalid API key",
    });
    expect(mockListSuppressions).not.toHaveBeenCalled();

    mockAuthorizeDashboardOrApiKey.mockResolvedValueOnce({
      apiKeyId: "key-1",
      permission: "sending_access",
      domain: null,
      userId: "user-1",
    });

    const forbidden = await GET(
      new Request("http://localhost:3015/api/suppressions", {
        headers: { Authorization: "Bearer os_test" },
      }),
    );

    expect(forbidden.status).toBe(403);
    await expect(forbidden.json()).resolves.toMatchObject({
      code: "insufficient_api_key_permission",
      statusCode: 403,
    });
    expect(mockListSuppressions).not.toHaveBeenCalled();
  });

  it("removes a suppression for the authenticated user", async () => {
    mockDeleteSuppression.mockResolvedValue({
      object: "suppression",
      deleted: true,
    });

    const { DELETE } = await import("@/app/api/suppressions/[email]/route");
    const res = await DELETE(
      new Request("http://localhost:3015/api/suppressions/blocked%40test.com", {
        method: "DELETE",
        headers: { Authorization: "Bearer os_test" },
      }),
      { params: Promise.resolve({ email: "blocked%40test.com" }) },
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      object: "suppression",
      deleted: true,
    });
    expect(mockDeleteSuppression).toHaveBeenCalledWith(
      "user-1",
      "blocked@test.com",
    );
  });

  it("preserves the not-found delete response when the core service misses", async () => {
    mockDeleteSuppression.mockRejectedValue(
      new MockSuppressionServiceError("not_found", "Suppression not found"),
    );

    const { DELETE } = await import("@/app/api/suppressions/[email]/route");
    const res = await DELETE(
      new Request("http://localhost:3015/api/suppressions/absent%40test.com", {
        method: "DELETE",
        headers: { Authorization: "Bearer os_test" },
      }),
      { params: Promise.resolve({ email: "absent%40test.com" }) },
    );

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({
      error: "Suppression not found",
      code: "not_found",
    });
  });

  it("exposes suppression list and delete through the Hono control-plane routes", async () => {
    mockListSuppressions.mockResolvedValue({
      object: "list",
      scope: "user",
      data: [
        {
          id: "supp-1",
          object: "suppression",
          email: "blocked@test.com",
          reason: "bounced",
          scope: "user",
        },
      ],
      has_more: true,
    });
    mockDeleteSuppression.mockResolvedValue({
      object: "suppression",
      deleted: true,
    });

    const { Hono } = await import("hono");
    const { registerSuppressionRoutes } = await import(
      "../services/api/src/routes/suppressions"
    );
    const app = new Hono();
    registerSuppressionRoutes(app);

    const listResponse = await app.request(
      "/suppressions?limit=10&after=supp-0",
      {
        headers: { Authorization: "Bearer os_test" },
      },
    );

    expect(listResponse.status).toBe(200);
    await expect(listResponse.json()).resolves.toEqual({
      object: "list",
      scope: "user",
      data: [
        {
          id: "supp-1",
          object: "suppression",
          email: "blocked@test.com",
          reason: "bounced",
          scope: "user",
        },
      ],
      has_more: true,
    });
    expect(mockListSuppressions).toHaveBeenCalledWith({
      userId: "user-1",
      limit: 10,
      after: "supp-0",
    });

    const deleteResponse = await app.request(
      "/suppressions/blocked%40test.com",
      {
        method: "DELETE",
        headers: { Authorization: "Bearer os_test" },
      },
    );

    expect(deleteResponse.status).toBe(200);
    await expect(deleteResponse.json()).resolves.toEqual({
      object: "suppression",
      deleted: true,
    });
    expect(mockDeleteSuppression).toHaveBeenCalledWith(
      "user-1",
      "blocked@test.com",
    );
  });

  it("preserves Hono suppression auth and permission failures before service calls", async () => {
    const { Hono } = await import("hono");
    const { registerSuppressionRoutes } = await import(
      "../services/api/src/routes/suppressions"
    );
    const app = new Hono();
    registerSuppressionRoutes(app);

    mockAuthorizeDashboardOrApiKey.mockResolvedValueOnce(null);
    const unauthorized = await app.request("/suppressions");

    expect(unauthorized.status).toBe(401);
    await expect(unauthorized.json()).resolves.toEqual({
      error: "Missing or invalid API key",
    });

    mockAuthorizeDashboardOrApiKey.mockResolvedValueOnce({
      apiKeyId: "key-1",
      permission: "sending_access",
      domain: null,
      userId: "user-1",
    });
    const forbidden = await app.request("/suppressions/blocked%40test.com", {
      method: "DELETE",
      headers: { Authorization: "Bearer os_test" },
    });

    expect(forbidden.status).toBe(403);
    await expect(forbidden.json()).resolves.toMatchObject({
      code: "insufficient_api_key_permission",
      statusCode: 403,
    });
    expect(mockListSuppressions).not.toHaveBeenCalled();
    expect(mockDeleteSuppression).not.toHaveBeenCalled();
  });
});
