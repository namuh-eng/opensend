import { beforeEach, describe, expect, it, vi } from "vitest";

const mockAuthorizeDashboardOrApiKey = vi.hoisted(() => vi.fn());
const mockGetServerSession = vi.hoisted(() => vi.fn());
const mockValidateApiKey = vi.hoisted(() => vi.fn());
const mockRequireFullAccessApiKey = vi.hoisted(() => vi.fn());
const mockRequireFullAccessForApiKeyCaller = vi.hoisted(() => vi.fn());
const mockAudienceMetadataService = vi.hoisted(() => ({
  createSegment: vi.fn(),
  listSegments: vi.fn(),
  getSegment: vi.fn(),
  deleteSegment: vi.fn(),
  listSegmentContacts: vi.fn(),
}));

class TestAudienceMetadataServiceError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "AudienceMetadataServiceError";
  }
}

function makeRequest(url: string, init?: RequestInit) {
  const request = new Request(url, init) as Request & { nextUrl: URL };
  request.nextUrl = new URL(url);
  return request;
}

vi.mock("@/lib/api-auth", () => ({
  authorizeDashboardOrApiKey: mockAuthorizeDashboardOrApiKey,
  getServerSession: mockGetServerSession,
  validateApiKey: mockValidateApiKey,
  unauthorizedResponse: () =>
    Response.json({ error: "Missing or invalid API key" }, { status: 401 }),
}));

vi.mock("@/lib/api-key-permissions", () => ({
  requireFullAccessApiKey: mockRequireFullAccessApiKey,
  requireFullAccessForApiKeyCaller: mockRequireFullAccessForApiKeyCaller,
}));

vi.mock("@opensend/core", () => ({
  AudienceMetadataServiceError: TestAudienceMetadataServiceError,
  createAudienceMetadataService: () => mockAudienceMetadataService,
  resolveBillingEntitlement: vi.fn(async () => ({
    mode: "self_host" as const,
  })),
}));

describe("Resend-compatible root segments API", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    const auth = {
      apiKeyId: "key-1",
      permission: "full_access",
      domain: null,
      userId: "user-1",
    };
    mockValidateApiKey.mockResolvedValue(auth);
    mockAuthorizeDashboardOrApiKey.mockResolvedValue(auth);
    mockGetServerSession.mockResolvedValue({ user: { id: "dashboard-user" } });
    mockRequireFullAccessApiKey.mockReturnValue(null);
    mockRequireFullAccessForApiKeyCaller.mockReturnValue(null);
  });

  it("creates, lists, retrieves, deletes, and lists contacts at root /segments paths", async () => {
    mockAudienceMetadataService.createSegment.mockResolvedValueOnce({
      object: "segment",
      id: "seg-1",
      name: "VIP",
    });
    mockAudienceMetadataService.listSegments.mockResolvedValueOnce({
      object: "list",
      data: [{ id: "seg-1", name: "VIP", created_at: "2026-05-12" }],
      has_more: false,
      total: 1,
    });
    mockAudienceMetadataService.getSegment.mockResolvedValueOnce({
      object: "segment",
      id: "seg-1",
      name: "VIP",
      created_at: "2026-05-12",
    });
    mockAudienceMetadataService.deleteSegment.mockResolvedValueOnce(undefined);
    mockAudienceMetadataService.listSegmentContacts.mockResolvedValueOnce({
      object: "list",
      data: [
        {
          id: "contact-1",
          email: "user@example.com",
          firstName: "User",
          lastName: "One",
          status: "subscribed",
          created_at: "2026-05-12",
        },
      ],
      has_more: false,
    });

    const collectionRoute = await import("@/app/segments/route");
    const detailRoute = await import("@/app/segments/[id]/route");
    const contactsRoute = await import("@/app/segments/[id]/contacts/route");

    const createResponse = await collectionRoute.POST(
      makeRequest("http://localhost/segments", {
        method: "POST",
        headers: {
          authorization: "Bearer os_test",
          "content-type": "application/json",
        },
        body: JSON.stringify({ name: "VIP" }),
      }),
    );
    expect(createResponse.status).toBe(201);
    await expect(createResponse.json()).resolves.toEqual({
      object: "segment",
      id: "seg-1",
      name: "VIP",
    });
    expect(mockAudienceMetadataService.createSegment).toHaveBeenCalledWith({
      userId: "user-1",
      body: { name: "VIP" },
    });

    const listResponse = await collectionRoute.GET(
      makeRequest("http://localhost/segments?limit=10&search=vip&after=seg-0", {
        headers: { authorization: "Bearer os_test" },
      }),
    );
    expect(listResponse.status).toBe(200);
    await expect(listResponse.json()).resolves.toMatchObject({
      object: "list",
      has_more: false,
      total: 1,
    });
    expect(mockAudienceMetadataService.listSegments).toHaveBeenCalledWith({
      userId: "user-1",
      limit: 10,
      search: "vip",
      after: "seg-0",
    });

    const getResponse = await detailRoute.GET(
      makeRequest("http://localhost/segments/seg-1", {
        headers: { authorization: "Bearer os_test" },
      }) as never,
      { params: Promise.resolve({ id: "seg-1" }) },
    );
    expect(getResponse.status).toBe(200);
    await expect(getResponse.json()).resolves.toMatchObject({
      object: "segment",
      id: "seg-1",
    });

    const deleteResponse = await detailRoute.DELETE(
      makeRequest("http://localhost/segments/seg-1", {
        method: "DELETE",
        headers: { authorization: "Bearer os_test" },
      }) as never,
      { params: Promise.resolve({ id: "seg-1" }) },
    );
    expect(deleteResponse.status).toBe(200);
    await expect(deleteResponse.json()).resolves.toEqual({ success: true });
    expect(mockAudienceMetadataService.deleteSegment).toHaveBeenCalledWith({
      userId: "user-1",
      id: "seg-1",
    });

    const contactsResponse = await contactsRoute.GET(
      makeRequest("http://localhost/segments/seg-1/contacts?limit=5", {
        headers: { authorization: "Bearer os_test" },
      }) as never,
      { params: Promise.resolve({ id: "seg-1" }) },
    );
    expect(contactsResponse.status).toBe(200);
    await expect(contactsResponse.json()).resolves.toMatchObject({
      object: "list",
      has_more: false,
      data: [{ id: "contact-1", email: "user@example.com" }],
    });
    expect(
      mockAudienceMetadataService.listSegmentContacts,
    ).toHaveBeenCalledWith({
      userId: "user-1",
      segmentId: "seg-1",
      limit: 5,
      after: undefined,
    });
  });

  it("keeps root /segments API-key-only while preserving dashboard-session access on /api/segments", async () => {
    mockValidateApiKey.mockResolvedValue(null);
    mockAuthorizeDashboardOrApiKey.mockResolvedValueOnce({ dashboard: true });
    mockAudienceMetadataService.listSegments.mockResolvedValueOnce({
      object: "list",
      data: [],
      has_more: false,
      total: 0,
    });

    const rootRoute = await import("@/app/segments/route");
    const apiRoute = await import("@/app/api/segments/route");

    const rootResponse = await rootRoute.GET(
      makeRequest("http://localhost/segments"),
    );
    expect(rootResponse.status).toBe(401);
    expect(mockAuthorizeDashboardOrApiKey).not.toHaveBeenCalled();

    const apiResponse = await apiRoute.GET(
      makeRequest("http://localhost/api/segments") as never,
    );
    expect(apiResponse.status).toBe(200);
    expect(mockAudienceMetadataService.listSegments).toHaveBeenCalledWith({
      userId: "dashboard-user",
      limit: undefined,
      search: undefined,
      after: undefined,
    });
  });

  it("keeps root segment detail aliases API-key-only while preserving dashboard-session access on /api/segments/:id", async () => {
    mockValidateApiKey.mockResolvedValue(null);
    mockAuthorizeDashboardOrApiKey.mockResolvedValueOnce({ dashboard: true });
    mockAudienceMetadataService.getSegment.mockResolvedValueOnce({
      object: "segment",
      id: "seg-1",
      name: "VIP",
      created_at: "2026-05-12",
    });

    const rootRoute = await import("@/app/segments/[id]/route");
    const apiRoute = await import("@/app/api/segments/[id]/route");

    const rootResponse = await rootRoute.GET(
      makeRequest("http://localhost/segments/seg-1") as never,
      { params: Promise.resolve({ id: "seg-1" }) },
    );
    expect(rootResponse.status).toBe(401);
    const rootDeleteResponse = await rootRoute.DELETE(
      makeRequest("http://localhost/segments/seg-1", {
        method: "DELETE",
      }) as never,
      { params: Promise.resolve({ id: "seg-1" }) },
    );
    expect(rootDeleteResponse.status).toBe(401);
    expect(mockAuthorizeDashboardOrApiKey).not.toHaveBeenCalled();
    expect(mockAudienceMetadataService.getSegment).not.toHaveBeenCalled();
    expect(mockAudienceMetadataService.deleteSegment).not.toHaveBeenCalled();

    const apiResponse = await apiRoute.GET(
      makeRequest("http://localhost/api/segments/seg-1") as never,
      { params: Promise.resolve({ id: "seg-1" }) },
    );
    expect(apiResponse.status).toBe(200);
    expect(mockAudienceMetadataService.getSegment).toHaveBeenCalledWith({
      userId: "dashboard-user",
      id: "seg-1",
    });
  });

  it("requires full-access API keys for root segment collection routes", async () => {
    mockRequireFullAccessApiKey.mockReturnValueOnce(
      Response.json(
        {
          error:
            "This API key does not have permission to access this resource.",
        },
        { status: 403 },
      ),
    );

    const rootRoute = await import("@/app/segments/route");
    const response = await rootRoute.POST(
      makeRequest("http://localhost/segments", {
        method: "POST",
        headers: {
          authorization: "Bearer os_test",
          "content-type": "application/json",
        },
        body: JSON.stringify({ name: "VIP" }),
      }),
    );

    expect(response.status).toBe(403);
    expect(mockAudienceMetadataService.createSegment).not.toHaveBeenCalled();
  });
});
