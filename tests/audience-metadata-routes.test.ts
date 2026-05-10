import { beforeEach, describe, expect, it, vi } from "vitest";

const mockAuthorizeDashboardOrApiKey = vi.hoisted(() => vi.fn());
const mockValidateApiKey = vi.hoisted(() => vi.fn());
const mockGetServerSession = vi.hoisted(() => vi.fn());
const mockListSegments = vi.hoisted(() => vi.fn());
const mockCreateTopic = vi.hoisted(() => vi.fn());
const mockGetProperty = vi.hoisted(() => vi.fn());
const mockUpdateTopic = vi.hoisted(() => vi.fn());

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

vi.mock("@/lib/api-auth", () => ({
  authorizeDashboardOrApiKey: mockAuthorizeDashboardOrApiKey,
  validateApiKey: mockValidateApiKey,
  getServerSession: mockGetServerSession,
  unauthorizedResponse: () =>
    Response.json({ error: "Missing or invalid API key" }, { status: 401 }),
}));

vi.mock("@opensend/core", () => ({
  AudienceMetadataServiceError: TestAudienceMetadataServiceError,
  createAudienceMetadataService: () => ({
    listSegments: mockListSegments,
    createTopic: mockCreateTopic,
    getProperty: mockGetProperty,
    updateTopic: mockUpdateTopic,
  }),
}));

function makeNextRequest(url: string, init?: RequestInit) {
  const request = new Request(url, init) as Request & { nextUrl: URL };
  request.nextUrl = new URL(url);
  return request;
}

describe("audience metadata route adapters", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockAuthorizeDashboardOrApiKey.mockResolvedValue({
      apiKeyId: "key-1",
      permission: "full_access",
      domain: null,
      userId: "user-1",
    });
    mockValidateApiKey.mockResolvedValue({
      apiKeyId: "key-1",
      permission: "full_access",
      domain: null,
      userId: "user-1",
    });
    mockGetServerSession.mockResolvedValue({ user: { id: "dashboard-user" } });
  });

  it("resolves dashboard-session user id for collection routes without dropping dashboard auth", async () => {
    mockAuthorizeDashboardOrApiKey.mockResolvedValueOnce({ dashboard: true });
    mockListSegments.mockResolvedValueOnce({
      object: "list",
      data: [],
      has_more: false,
      total: 0,
    });
    const { GET } = await import("@/app/api/segments/route");

    const response = await GET(
      makeNextRequest(
        "http://localhost/api/segments?limit=10&search=vip",
      ) as never,
    );

    expect(response.status).toBe(200);
    expect(mockListSegments).toHaveBeenCalledWith({
      userId: "dashboard-user",
      limit: 10,
      search: "vip",
      after: undefined,
    });
  });

  it("maps collection create payloads through service and preserves 201 response", async () => {
    mockCreateTopic.mockResolvedValueOnce({
      object: "topic",
      id: "topic-1",
      name: "News",
      description: null,
      defaultSubscription: "opt_out",
      visibility: "public",
      createdAt: "2026-05-10T00:00:00.000Z",
    });
    const { POST } = await import("@/app/api/topics/route");

    const response = await POST(
      makeNextRequest("http://localhost/api/topics", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "News" }),
      }) as never,
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      object: "topic",
      id: "topic-1",
    });
    expect(mockCreateTopic).toHaveBeenCalledWith({
      userId: "user-1",
      body: { name: "News" },
    });
  });

  it("keeps detail routes API-key-only and tenant-scoped through auth.userId", async () => {
    mockGetProperty.mockResolvedValueOnce({
      id: "prop-1",
      key: "company",
      name: "Company",
      type: "string",
      fallback_value: null,
      created_at: "2026-05-10T00:00:00.000Z",
      updated_at: "2026-05-10T00:00:00.000Z",
    });
    const { GET } = await import("@/app/api/properties/[id]/route");

    const response = await GET(
      makeNextRequest("http://localhost/api/properties/prop-1", {
        headers: { authorization: "Bearer re_test" },
      }) as never,
      { params: Promise.resolve({ id: "prop-1" }) },
    );

    expect(response.status).toBe(200);
    expect(mockGetProperty).toHaveBeenCalledWith({
      userId: "user-1",
      id: "prop-1",
    });
    expect(mockAuthorizeDashboardOrApiKey).not.toHaveBeenCalled();
  });

  it("maps service validation and not-found errors to existing HTTP error envelopes", async () => {
    mockUpdateTopic.mockRejectedValueOnce(
      new TestAudienceMetadataServiceError(
        "invalid_input",
        "No fields to update",
        400,
      ),
    );
    const { PATCH } = await import("@/app/api/topics/[id]/route");

    const response = await PATCH(
      makeNextRequest("http://localhost/api/topics/topic-1", {
        method: "PATCH",
        headers: {
          authorization: "Bearer re_test",
          "content-type": "application/json",
        },
        body: JSON.stringify({}),
      }) as never,
      { params: Promise.resolve({ id: "topic-1" }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "No fields to update",
    });
  });

  it("rejects detail calls when the API key has no tenant owner", async () => {
    mockValidateApiKey.mockResolvedValueOnce({
      apiKeyId: "legacy-key",
      permission: "full_access",
      domain: null,
      userId: null,
    });
    const { GET } = await import("@/app/api/properties/[id]/route");

    const response = await GET(
      makeNextRequest("http://localhost/api/properties/prop-1", {
        headers: { authorization: "Bearer re_test" },
      }) as never,
      { params: Promise.resolve({ id: "prop-1" }) },
    );

    expect(response.status).toBe(401);
    expect(mockGetProperty).not.toHaveBeenCalled();
  });
});
