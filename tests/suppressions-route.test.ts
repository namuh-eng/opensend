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
const mockCreateSuppression = vi.hoisted(() => vi.fn());
const mockImportSuppressions = vi.hoisted(() => vi.fn());
const mockExportSuppressions = vi.hoisted(() => vi.fn());
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
  SUPPRESSION_EXPORT_LIMIT: 1000,
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
      async suppress(input) {
        return suppressionRow({ email: input.email, reason: input.reason });
      },
    };

    const service = createActualSuppressionService({ repository });
    const response = await service.listSuppressions({
      userId: "user-1",
      limit: 500,
      after: "supp-0",
    });

    expect(calls).toEqual([
      { userId: "user-1", limit: 100, after: "supp-0", filters: {} },
    ]);
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
      { userId: "user-1", limit: 1, after: undefined, filters: {} },
      { userId: "user-1", limit: 50, after: undefined, filters: {} },
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
      async suppress(input) {
        return suppressionRow({ email: input.email, reason: input.reason });
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

  it("upserts a manual suppression and returns the public DTO", async () => {
    const suppressedAtDate = new Date("2026-05-05T12:00:00.000Z");
    const updatedAtDate = new Date("2026-05-05T12:30:00.000Z");
    const row = suppressionRow({
      reason: "manual",
      metadata: { source: "manual" },
      sourceEventId: null,
      sourceEmailId: null,
      sourceMessageId: null,
      suppressedAt: suppressedAtDate,
      updatedAt: updatedAtDate,
    });

    const suppressCalls: Parameters<SuppressionRepository["suppress"]>[0][] =
      [];
    const repository: SuppressionRepository = {
      async list() {
        return { data: [], hasMore: false };
      },
      async removeForUser() {
        return [];
      },
      async suppress(input) {
        suppressCalls.push(input);
        return row;
      },
    };

    const service = createActualSuppressionService({ repository });
    const result = await service.createSuppression({
      userId: "user-1",
      email: "manual@test.com",
    });

    expect(suppressCalls).toHaveLength(1);
    expect(suppressCalls[0]).toMatchObject({
      userId: "user-1",
      email: "manual@test.com",
      reason: "manual",
      metadata: { source: "manual" },
    });

    expect(result).toMatchObject({
      id: "supp-1",
      object: "suppression",
      email: "blocked@test.com",
      reason: "manual",
      scope: "user",
      suppressed_at: suppressedAtDate.toISOString(),
      updated_at: updatedAtDate.toISOString(),
    });
  });

  it("uses the provided reason when creating a suppression", async () => {
    const suppressCalls: Parameters<SuppressionRepository["suppress"]>[0][] =
      [];
    const repository: SuppressionRepository = {
      async list() {
        return { data: [], hasMore: false };
      },
      async removeForUser() {
        return [];
      },
      async suppress(input) {
        suppressCalls.push(input);
        return suppressionRow({ reason: input.reason });
      },
    };

    const service = createActualSuppressionService({ repository });
    const result = await service.createSuppression({
      userId: "user-1",
      email: "bounced@test.com",
      reason: "bounced",
    });

    expect(suppressCalls[0]?.reason).toBe("bounced");
    expect(result.reason).toBe("bounced");
  });

  it("passes suppression filters to the repository", async () => {
    const calls: Parameters<SuppressionRepository["list"]>[0][] = [];
    const repository: SuppressionRepository = {
      async list(options) {
        calls.push(options);
        return { data: [], hasMore: false };
      },
      async removeForUser() {
        return [];
      },
      async suppress(input) {
        return suppressionRow({ email: input.email, reason: input.reason });
      },
    };

    const service = createActualSuppressionService({ repository });
    const createdAfter = new Date("2026-05-01T00:00:00.000Z");
    const createdBefore = new Date("2026-05-02T00:00:00.000Z");
    await service.listSuppressions({
      userId: "user-1",
      limit: 25,
      search: "blocked",
      reason: "manual",
      source: "ses",
      createdAfter,
      createdBefore,
      domain: "example.com",
      topicId: "topic-1",
    });

    expect(calls[0]).toEqual({
      userId: "user-1",
      limit: 25,
      after: undefined,
      filters: {
        search: "blocked",
        reason: "manual",
        source: "ses",
        createdAfter,
        createdBefore,
        domain: "example.com",
        topicId: "topic-1",
      },
    });
  });

  it("rejects malformed import rows with actionable row feedback before writes", async () => {
    const repository: SuppressionRepository = {
      async list() {
        return { data: [], hasMore: false };
      },
      async removeForUser() {
        return [];
      },
      async suppress() {
        throw new Error("must not write invalid import rows");
      },
    };

    const service = createActualSuppressionService({ repository });
    const result = await service.importSuppressions({
      userId: "user-1",
      csv: "email,reason\nvalid@example.com,manual\nnot-email,bad",
    });

    expect(result).toMatchObject({
      object: "suppression_import",
      imported_count: 0,
      rejected_count: 2,
      data: [],
    });
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ row: 3, field: "email" }),
        expect.objectContaining({ row: 3, field: "reason" }),
      ]),
    );
  });

  it("imports valid CSV rows as manual-source suppressions", async () => {
    const suppressCalls: Parameters<SuppressionRepository["suppress"]>[0][] =
      [];
    const repository: SuppressionRepository = {
      async list() {
        return { data: [], hasMore: false };
      },
      async removeForUser() {
        return [];
      },
      async suppress(input) {
        suppressCalls.push(input);
        return suppressionRow({
          email: input.email.toLowerCase(),
          reason: input.reason,
        });
      },
    };

    const service = createActualSuppressionService({ repository });
    const result = await service.importSuppressions({
      userId: "user-1",
      csv: "email,reason\nImport@Test.com,complained",
    });

    expect(result.imported_count).toBe(1);
    expect(suppressCalls).toEqual([
      expect.objectContaining({
        userId: "user-1",
        email: "Import@Test.com",
        reason: "complained",
        metadata: { source: "manual", importRow: 2 },
      }),
    ]);
  });

  it("exports bounded sanitized CSV", async () => {
    const repository: SuppressionRepository = {
      async list() {
        return {
          data: [
            suppressionRow({ email: "=cmd@example.com", reason: "manual" }),
          ],
          hasMore: false,
        };
      },
      async removeForUser() {
        return [];
      },
      async suppress(input) {
        return suppressionRow({ email: input.email, reason: input.reason });
      },
    };

    const service = createActualSuppressionService({ repository });
    const result = await service.exportSuppressions({ userId: "user-1" });

    expect(result.row_count).toBe(1);
    expect(result.csv).toContain("'=");
    expect(result.csv).toContain("email,reason");
  });
});

describe("suppression management routes", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockCreateSuppressionService.mockReturnValue({
      listSuppressions: mockListSuppressions,
      deleteSuppression: mockDeleteSuppression,
      createSuppression: mockCreateSuppression,
      importSuppressions: mockImportSuppressions,
      exportSuppressions: mockExportSuppressions,
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
      search: undefined,
      reason: undefined,
      source: undefined,
      createdAfter: undefined,
      createdBefore: undefined,
      domain: undefined,
      topicId: undefined,
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
      search: undefined,
      reason: undefined,
      source: undefined,
      createdAfter: undefined,
      createdBefore: undefined,
      domain: undefined,
      topicId: undefined,
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
      search: undefined,
      reason: undefined,
      source: undefined,
      createdAfter: undefined,
      createdBefore: undefined,
      domain: undefined,
      topicId: undefined,
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

  it("creates a suppression and returns HTTP 201 with the public DTO", async () => {
    const publicItem = {
      id: "supp-new",
      object: "suppression",
      email: "new@test.com",
      reason: "manual",
      scope: "user",
      source_event_id: null,
      source_email_id: null,
      source_message_id: null,
      metadata: { source: "manual" },
      suppressed_at: "2026-05-05T12:00:00.000Z",
      updated_at: "2026-05-05T12:30:00.000Z",
    };
    mockCreateSuppression.mockResolvedValue(publicItem);

    const { POST } = await import("@/app/api/suppressions/route");
    const res = await POST(
      new Request("http://localhost:3015/api/suppressions", {
        method: "POST",
        headers: {
          Authorization: "Bearer os_test",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: "new@test.com" }),
      }),
    );

    expect(res.status).toBe(201);
    await expect(res.json()).resolves.toEqual(publicItem);
    expect(mockCreateSuppression).toHaveBeenCalledWith({
      userId: "user-1",
      email: "new@test.com",
      reason: undefined,
    });
  });

  it("rejects an invalid email with HTTP 422", async () => {
    const { POST } = await import("@/app/api/suppressions/route");
    const res = await POST(
      new Request("http://localhost:3015/api/suppressions", {
        method: "POST",
        headers: {
          Authorization: "Bearer os_test",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: "not-an-email" }),
      }),
    );

    expect(res.status).toBe(422);
    const body = (await res.json()) as { error: string; details: unknown };
    expect(body.error).toBe("Validation failed");
    expect(mockCreateSuppression).not.toHaveBeenCalled();
  });

  it("is idempotent — duplicate email returns updated row with HTTP 201", async () => {
    const existingItem = {
      id: "supp-existing",
      object: "suppression",
      email: "dup@test.com",
      reason: "manual",
      scope: "user",
      source_event_id: null,
      source_email_id: null,
      source_message_id: null,
      metadata: { source: "manual" },
      suppressed_at: "2026-05-05T12:00:00.000Z",
      updated_at: "2026-05-05T12:30:00.000Z",
    };
    mockCreateSuppression.mockResolvedValue(existingItem);

    const { POST } = await import("@/app/api/suppressions/route");
    const res = await POST(
      new Request("http://localhost:3015/api/suppressions", {
        method: "POST",
        headers: {
          Authorization: "Bearer os_test",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: "dup@test.com" }),
      }),
    );

    expect(res.status).toBe(201);
    await expect(res.json()).resolves.toEqual(existingItem);
  });

  it("blocks unauthenticated POST requests with HTTP 401", async () => {
    mockAuthorizeDashboardOrApiKey.mockResolvedValueOnce(null);

    const { POST } = await import("@/app/api/suppressions/route");
    const res = await POST(
      new Request("http://localhost:3015/api/suppressions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "any@test.com" }),
      }),
    );

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({
      error: "Missing or invalid API key",
    });
    expect(mockCreateSuppression).not.toHaveBeenCalled();
  });

  it("creates a suppression through the Hono control-plane route", async () => {
    const publicItem = {
      id: "supp-hono",
      object: "suppression",
      email: "hono@test.com",
      reason: "bounced",
      scope: "user",
      source_event_id: null,
      source_email_id: null,
      source_message_id: null,
      metadata: { source: "manual" },
      suppressed_at: "2026-05-05T12:00:00.000Z",
      updated_at: "2026-05-05T12:30:00.000Z",
    };
    mockCreateSuppression.mockResolvedValue(publicItem);

    const { Hono } = await import("hono");
    const { registerSuppressionRoutes } = await import(
      "../services/api/src/routes/suppressions"
    );
    const app = new Hono();
    registerSuppressionRoutes(app);

    const response = await app.request("/suppressions", {
      method: "POST",
      headers: {
        Authorization: "Bearer os_test",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email: "hono@test.com", reason: "bounced" }),
    });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual(publicItem);
    expect(mockCreateSuppression).toHaveBeenCalledWith({
      userId: "user-1",
      email: "hono@test.com",
      reason: "bounced",
    });
  });

  it("passes filters through list routes", async () => {
    mockListSuppressions.mockResolvedValue({
      object: "list",
      scope: "user",
      data: [],
      has_more: false,
    });

    const { GET } = await import("@/app/api/suppressions/route");
    const res = await GET(
      new Request(
        "http://localhost:3015/api/suppressions?q=blocked&reason=manual&source=ses&created_after=2026-05-01&created_before=2026-05-02&domain=example.com&topic_id=topic-1",
        { headers: { Authorization: "Bearer os_test" } },
      ),
    );

    expect(res.status).toBe(200);
    expect(mockListSuppressions).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        search: "blocked",
        reason: "manual",
        source: "ses",
        domain: "example.com",
        topicId: "topic-1",
      }),
    );
    expect(
      mockListSuppressions.mock.calls.at(-1)?.[0].createdAfter,
    ).toBeInstanceOf(Date);
    expect(
      mockListSuppressions.mock.calls.at(-1)?.[0].createdBefore,
    ).toBeInstanceOf(Date);
  });

  it("imports suppressions and returns per-row validation feedback", async () => {
    mockImportSuppressions.mockResolvedValue({
      object: "suppression_import",
      imported_count: 0,
      rejected_count: 1,
      limit: 200,
      data: [],
      errors: [
        {
          row: 2,
          field: "email",
          value: "bad",
          message: "Email must be valid.",
        },
      ],
    });

    const { POST } = await import("@/app/api/suppressions/import/route");
    const res = await POST(
      new Request("http://localhost:3015/api/suppressions/import", {
        method: "POST",
        headers: {
          Authorization: "Bearer os_test",
          "Content-Type": "text/csv",
        },
        body: "email\nbad",
      }),
    );

    expect(res.status).toBe(422);
    await expect(res.json()).resolves.toMatchObject({
      object: "suppression_import",
      rejected_count: 1,
    });
    expect(mockImportSuppressions).toHaveBeenCalledWith({
      userId: "user-1",
      csv: "email\nbad",
    });
  });

  it("exports suppressions as bounded CSV", async () => {
    mockExportSuppressions.mockResolvedValue({
      object: "suppression_export",
      row_count: 1,
      limit: 1000,
      csv: "email,reason\nblocked@test.com,manual",
    });

    const { GET } = await import("@/app/api/suppressions/export/route");
    const res = await GET(
      new Request(
        "http://localhost:3015/api/suppressions/export?source=manual",
        {
          headers: { Authorization: "Bearer os_test" },
        },
      ),
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    expect(res.headers.get("x-opensend-export-rows")).toBe("1");
    await expect(res.text()).resolves.toContain("blocked@test.com");
    expect(mockExportSuppressions).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-1", source: "manual" }),
    );
  });
});
