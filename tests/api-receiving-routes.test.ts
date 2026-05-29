import { beforeEach, describe, expect, it, vi } from "vitest";

const mockAuthorize = vi.hoisted(() => vi.fn());
const mockGetServerSession = vi.hoisted(() => vi.fn());
const mockRecordAuditEvent = vi.hoisted(() => vi.fn());
const mockReceivingRouteService = vi.hoisted(() => ({
  listRoutes: vi.fn(),
  getRoute: vi.fn(),
  createRoute: vi.fn(),
  updateRoute: vi.fn(),
  deleteRoute: vi.fn(),
}));

const MockReceivingRouteServiceError = vi.hoisted(
  () =>
    class ReceivingRouteServiceError extends Error {
      constructor(
        readonly code: string,
        message: string,
      ) {
        super(message);
        this.name = "ReceivingRouteServiceError";
      }
    },
);

vi.mock("@opensend/core", () => ({
  ReceivingRouteServiceError: MockReceivingRouteServiceError,
  createReceivingRouteService: () => mockReceivingRouteService,
}));

vi.mock("@/lib/api-auth", () => ({
  authorizeDashboardOrApiKey: mockAuthorize,
  getServerSession: mockGetServerSession,
  unauthorizedResponse: () =>
    Response.json({ error: "Missing or invalid API key" }, { status: 401 }),
}));

vi.mock("@/lib/audit-events", () => ({
  auditContextForApiKey: ({
    userId,
    apiKeyId,
  }: { userId: string; apiKeyId: string }) => ({
    userId,
    actor: { type: "api_key", id: apiKeyId },
    source: "api_key",
    sourceApiKeyId: apiKeyId,
  }),
  auditContextForDashboardSession: (
    session: { user?: { id?: string } } | null,
  ) =>
    session?.user?.id
      ? {
          userId: session.user.id,
          actor: { type: "user", id: session.user.id },
          source: "dashboard",
          sourceApiKeyId: null,
        }
      : null,
  recordAuditEvent: mockRecordAuditEvent,
}));

const AUTH_RESULT = {
  apiKeyId: "key-uuid",
  permission: "full_access",
  domain: null,
  userId: "user-1",
};

const DOMAIN_ID = "11111111-1111-4111-8111-111111111111";
const ROUTE_ID = "22222222-2222-4222-8222-222222222222";

function makeRoute(overrides: Record<string, unknown> = {}) {
  return {
    object: "receiving_route",
    id: ROUTE_ID,
    domain_id: DOMAIN_ID,
    domain: "inbound.example.com",
    type: "exact",
    local_part: "support",
    target_local_part: "support",
    target_address: "support@inbound.example.com",
    created_at: new Date("2026-05-28T00:00:00.000Z"),
    updated_at: new Date("2026-05-28T00:00:00.000Z"),
    ...overrides,
  };
}

describe("receiving route API boundary", () => {
  beforeEach(() => {
    vi.resetModules();
    mockAuthorize.mockResolvedValue(AUTH_RESULT);
    mockGetServerSession.mockReset();
    mockRecordAuditEvent.mockReset();
    mockReceivingRouteService.listRoutes.mockReset();
    mockReceivingRouteService.getRoute.mockReset();
    mockReceivingRouteService.createRoute.mockReset();
    mockReceivingRouteService.updateRoute.mockReset();
    mockReceivingRouteService.deleteRoute.mockReset();
  });

  it("lists routes for the authenticated tenant and optional domain", async () => {
    mockReceivingRouteService.listRoutes.mockResolvedValueOnce({
      object: "list",
      data: [makeRoute()],
    });

    const { GET } = await import("@/app/api/receiving/routes/route");
    const response = await GET(
      new Request(
        `http://localhost:3015/api/receiving/routes?domain_id=${DOMAIN_ID}`,
        {
          headers: { Authorization: "Bearer os_test123" },
        },
      ),
    );

    expect(response.status).toBe(200);
    expect(mockReceivingRouteService.listRoutes).toHaveBeenCalledWith({
      userId: "user-1",
      domainId: DOMAIN_ID,
    });
  });

  it("creates routes with tenant ownership context and records an audit event", async () => {
    mockReceivingRouteService.createRoute.mockResolvedValueOnce(makeRoute());

    const { POST } = await import("@/app/api/receiving/routes/route");
    const response = await POST(
      new Request("http://localhost:3015/api/receiving/routes", {
        method: "POST",
        headers: {
          Authorization: "Bearer os_test123",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          domain_id: DOMAIN_ID,
          type: "exact",
          local_part: "Support",
        }),
      }),
    );

    expect(response.status).toBe(201);
    expect(mockReceivingRouteService.createRoute).toHaveBeenCalledWith({
      userId: "user-1",
      domainId: DOMAIN_ID,
      type: "exact",
      localPart: "Support",
      targetLocalPart: undefined,
    });
    expect(mockRecordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "receiving_route.created",
        targetType: "receiving_route",
        targetId: ROUTE_ID,
      }),
    );
  });

  it("rejects malformed route payloads before service mutation", async () => {
    const { POST } = await import("@/app/api/receiving/routes/route");
    const response = await POST(
      new Request("http://localhost:3015/api/receiving/routes", {
        method: "POST",
        headers: {
          Authorization: "Bearer os_test123",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          domain_id: DOMAIN_ID,
          type: "alias",
          local_part: "bad local",
          target_local_part: "support",
        }),
      }),
    );

    expect(response.status).toBe(422);
    expect(mockReceivingRouteService.createRoute).not.toHaveBeenCalled();
  });

  it("maps cross-tenant route lookups to not found", async () => {
    mockReceivingRouteService.getRoute.mockRejectedValueOnce(
      new MockReceivingRouteServiceError(
        "route_not_found",
        "Receiving route not found",
      ),
    );

    const { GET } = await import("@/app/api/receiving/routes/[id]/route");
    const response = await GET(
      new Request(`http://localhost:3015/api/receiving/routes/${ROUTE_ID}`, {
        headers: { Authorization: "Bearer os_test123" },
      }),
      { params: Promise.resolve({ id: ROUTE_ID }) },
    );

    expect(response.status).toBe(404);
    expect(mockReceivingRouteService.getRoute).toHaveBeenCalledWith(
      ROUTE_ID,
      "user-1",
    );
  });

  it("updates and deletes through tenant-scoped service calls", async () => {
    mockReceivingRouteService.updateRoute.mockResolvedValueOnce(
      makeRoute({ target_local_part: "inbox" }),
    );
    mockReceivingRouteService.deleteRoute.mockResolvedValueOnce({
      object: "receiving_route",
      id: ROUTE_ID,
      deleted: true,
    });

    const route = await import("@/app/api/receiving/routes/[id]/route");
    const patch = await route.PATCH(
      new Request(`http://localhost:3015/api/receiving/routes/${ROUTE_ID}`, {
        method: "PATCH",
        headers: {
          Authorization: "Bearer os_test123",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ target_local_part: "inbox" }),
      }),
      { params: Promise.resolve({ id: ROUTE_ID }) },
    );
    const del = await route.DELETE(
      new Request(`http://localhost:3015/api/receiving/routes/${ROUTE_ID}`, {
        method: "DELETE",
        headers: { Authorization: "Bearer os_test123" },
      }),
      { params: Promise.resolve({ id: ROUTE_ID }) },
    );

    expect(patch.status).toBe(200);
    expect(del.status).toBe(200);
    expect(mockReceivingRouteService.updateRoute).toHaveBeenCalledWith({
      id: ROUTE_ID,
      userId: "user-1",
      localPart: undefined,
      targetLocalPart: "inbox",
    });
    expect(mockReceivingRouteService.deleteRoute).toHaveBeenCalledWith(
      ROUTE_ID,
      "user-1",
    );
  });
});
