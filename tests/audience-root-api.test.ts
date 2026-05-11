import { beforeEach, describe, expect, it, vi } from "vitest";

const mockAuthorizeDashboardOrApiKey = vi.hoisted(() => vi.fn());
const mockGetServerSession = vi.hoisted(() => vi.fn());
const mockValidateApiKey = vi.hoisted(() => vi.fn());
const mockAudienceMetadataService = vi.hoisted(() => ({
  createSegment: vi.fn(),
  listSegments: vi.fn(),
  getSegment: vi.fn(),
  deleteSegment: vi.fn(),
}));
const MockAudienceMetadataServiceError = vi.hoisted(
  () =>
    class AudienceMetadataServiceError extends Error {
      constructor(
        readonly code: "invalid_input" | "not_found",
        message: string,
        readonly status: number,
      ) {
        super(message);
        this.name = "AudienceMetadataServiceError";
      }
    },
);

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

vi.mock("@opensend/core", () => ({
  AudienceMetadataServiceError: MockAudienceMetadataServiceError,
  createAudienceMetadataService: () => mockAudienceMetadataService,
}));

describe("Resend-compatible root audiences API", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
    const auth = {
      apiKeyId: "key-1",
      permission: "full_access",
      domain: null,
      userId: "user-1",
    };
    mockAuthorizeDashboardOrApiKey.mockResolvedValue(auth);
    mockValidateApiKey.mockResolvedValue(auth);
    mockGetServerSession.mockResolvedValue(null);
  });

  it("creates, lists, retrieves, and deletes audiences through segment storage", async () => {
    const createdAt = new Date("2026-05-11T00:00:00.000Z");
    mockAudienceMetadataService.createSegment.mockResolvedValueOnce({
      object: "segment",
      id: "seg-1",
      name: "Registered Users",
    });
    mockAudienceMetadataService.listSegments.mockResolvedValueOnce({
      object: "list",
      has_more: false,
      total: 1,
      data: [
        {
          id: "seg-1",
          name: "Registered Users",
          created_at: createdAt.toISOString(),
        },
      ],
    });
    mockAudienceMetadataService.getSegment.mockResolvedValueOnce({
      object: "segment",
      id: "seg-1",
      name: "Registered Users",
      created_at: createdAt,
    });
    mockAudienceMetadataService.deleteSegment.mockResolvedValueOnce(undefined);

    const collectionRoute = await import("@/app/audiences/route");
    const detailRoute = await import("@/app/audiences/[audience_id]/route");

    const createResponse = await collectionRoute.POST(
      makeRequest("http://localhost/audiences", {
        method: "POST",
        headers: {
          authorization: "Bearer key",
          "content-type": "application/json",
        },
        body: JSON.stringify({ name: "Registered Users" }),
      }),
    );

    expect(createResponse.status).toBe(201);
    await expect(createResponse.json()).resolves.toEqual({
      object: "audience",
      id: "seg-1",
      name: "Registered Users",
    });
    expect(mockAudienceMetadataService.createSegment).toHaveBeenCalledWith({
      userId: "user-1",
      body: { name: "Registered Users" },
    });

    const listResponse = await collectionRoute.GET(
      makeRequest("http://localhost/audiences?limit=10&search=registered", {
        headers: { authorization: "Bearer key" },
      }),
    );
    await expect(listResponse.json()).resolves.toEqual({
      object: "list",
      has_more: false,
      data: [
        {
          id: "seg-1",
          name: "Registered Users",
          created_at: createdAt.toISOString(),
        },
      ],
    });
    expect(mockAudienceMetadataService.listSegments).toHaveBeenCalledWith({
      userId: "user-1",
      limit: 10,
      search: "registered",
      after: undefined,
    });

    const getResponse = await detailRoute.GET(
      makeRequest("http://localhost/audiences/seg-1", {
        headers: { authorization: "Bearer key" },
      }),
      { params: Promise.resolve({ audience_id: "seg-1" }) },
    );
    await expect(getResponse.json()).resolves.toEqual({
      object: "audience",
      id: "seg-1",
      name: "Registered Users",
      created_at: createdAt.toISOString(),
    });
    expect(mockAudienceMetadataService.getSegment).toHaveBeenCalledWith({
      userId: "user-1",
      id: "seg-1",
    });

    const deleteResponse = await detailRoute.DELETE(
      makeRequest("http://localhost/audiences/seg-1", {
        method: "DELETE",
        headers: { authorization: "Bearer key" },
      }),
      { params: Promise.resolve({ audience_id: "seg-1" }) },
    );
    await expect(deleteResponse.json()).resolves.toEqual({
      object: "audience",
      id: "seg-1",
      deleted: true,
    });
    expect(mockAudienceMetadataService.deleteSegment).toHaveBeenCalledWith({
      userId: "user-1",
      id: "seg-1",
    });
  });

  it("preserves full-access API key enforcement for send-only audience calls", async () => {
    mockValidateApiKey.mockResolvedValueOnce({
      apiKeyId: "send-key",
      permission: "sending_access",
      domain: null,
      userId: "user-1",
    });

    const detailRoute = await import("@/app/audiences/[audience_id]/route");
    const response = await detailRoute.GET(
      makeRequest("http://localhost/audiences/seg-1", {
        headers: { authorization: "Bearer send-key" },
      }),
      { params: Promise.resolve({ audience_id: "seg-1" }) },
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      name: "insufficient_api_key_permission",
      code: "insufficient_api_key_permission",
      statusCode: 403,
    });
    expect(mockAudienceMetadataService.getSegment).not.toHaveBeenCalled();
  });

  it("maps segment service errors without leaking segment object responses", async () => {
    mockAudienceMetadataService.getSegment.mockRejectedValueOnce(
      new MockAudienceMetadataServiceError(
        "not_found",
        "Segment not found",
        404,
      ),
    );

    const detailRoute = await import("@/app/audiences/[audience_id]/route");
    const response = await detailRoute.GET(
      makeRequest("http://localhost/audiences/missing", {
        headers: { authorization: "Bearer key" },
      }),
      { params: Promise.resolve({ audience_id: "missing" }) },
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "Segment not found",
    });
  });
});
