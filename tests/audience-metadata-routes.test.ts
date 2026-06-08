import { beforeEach, describe, expect, it, vi } from "vitest";

const mockAuthorizeDashboardOrApiKey = vi.hoisted(() => vi.fn());
const mockValidateApiKey = vi.hoisted(() => vi.fn());
const mockGetServerSession = vi.hoisted(() => vi.fn());
const mockListSegments = vi.hoisted(() => vi.fn());
const mockListSegmentContacts = vi.hoisted(() => vi.fn());
const mockCreateTopic = vi.hoisted(() => vi.fn());
const mockCreateProperty = vi.hoisted(() => vi.fn());
const mockGetProperty = vi.hoisted(() => vi.fn());
const mockUpdateTopic = vi.hoisted(() => vi.fn());
const mockUpdateProperty = vi.hoisted(() => vi.fn());

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
    listSegmentContacts: mockListSegmentContacts,
    createTopic: mockCreateTopic,
    createProperty: mockCreateProperty,
    getProperty: mockGetProperty,
    updateTopic: mockUpdateTopic,
    updateProperty: mockUpdateProperty,
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
      mode: "api",
    });
  });

  it("passes root-api alias mode to strict topic service path when header is present", async () => {
    mockCreateTopic.mockResolvedValueOnce({
      object: "topic",
      id: "topic-1",
      name: "News",
      description: null,
      defaultSubscription: "opt_in",
      visibility: "private",
      createdAt: "2026-05-10T00:00:00.000Z",
    });
    const { POST } = await import("@/app/api/topics/route");

    const response = await POST(
      makeNextRequest("http://localhost/api/topics", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-opensend-root-api-alias": "topics",
        },
        body: JSON.stringify({
          name: "News",
          default_subscription: "opt_in",
          visibility: "private",
        }),
      }) as never,
    );

    expect(response.status).toBe(201);
    expect(mockCreateTopic).toHaveBeenCalledWith({
      userId: "user-1",
      body: {
        name: "News",
        default_subscription: "opt_in",
        visibility: "private",
      },
      mode: "root",
    });
  });

  it("passes root-api alias mode to strict property service path when header is present", async () => {
    mockCreateProperty.mockResolvedValueOnce({
      object: "contact_property",
      id: "prop-1",
      key: "company_size",
      name: "Company size",
      type: "number",
      fallback_value: null,
      created_at: "2026-05-10T00:00:00.000Z",
      updated_at: "2026-05-10T00:00:00.000Z",
    });
    const { POST } = await import("@/app/api/properties/route");

    const response = await POST(
      makeNextRequest("http://localhost/api/properties", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-opensend-root-api-alias": "contact-properties",
        },
        body: JSON.stringify({
          name: "Company size",
          key: "company_size",
          type: "number",
        }),
      }) as never,
    );

    expect(response.status).toBe(201);
    expect(mockCreateProperty).toHaveBeenCalledWith({
      userId: "user-1",
      body: {
        name: "Company size",
        key: "company_size",
        type: "number",
      },
      mode: "root",
    });
  });

  it("defaults /api properties to API-compatible key/type behavior", async () => {
    mockCreateProperty.mockResolvedValueOnce({
      object: "contact_property",
      id: "prop-1",
      key: "company_size",
      name: "Company Size",
      type: "string",
      fallback_value: null,
      created_at: "2026-05-10T00:00:00.000Z",
      updated_at: "2026-05-10T00:00:00.000Z",
    });
    const { POST } = await import("@/app/api/properties/route");

    const response = await POST(
      makeNextRequest("http://localhost/api/properties", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ name: "Company Size" }),
      }) as never,
    );

    expect(response.status).toBe(201);
    expect(mockCreateProperty).toHaveBeenCalledWith({
      userId: "user-1",
      body: {
        name: "Company Size",
      },
      mode: "api",
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
        headers: { authorization: "Bearer os_test" },
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

  it("keeps segment contacts as an API-key-only thin service adapter", async () => {
    mockListSegmentContacts.mockResolvedValueOnce({
      object: "list",
      data: [
        {
          id: "contact-1",
          email: "user@example.com",
          firstName: "User",
          lastName: "One",
          status: "subscribed",
          created_at: "2026-05-10T00:00:00.000Z",
        },
      ],
      has_more: false,
    });
    const { GET } = await import("@/app/api/segments/[id]/contacts/route");

    const response = await GET(
      makeNextRequest(
        "http://localhost/api/segments/seg-1/contacts?limit=10&after=contact-9",
        {
          headers: { authorization: "Bearer os_test" },
        },
      ) as never,
      { params: Promise.resolve({ id: "seg-1" }) },
    );

    expect(response.status).toBe(200);
    expect(mockListSegmentContacts).toHaveBeenCalledWith({
      userId: "user-1",
      segmentId: "seg-1",
      limit: 10,
      after: "contact-9",
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
          authorization: "Bearer os_test",
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

  it("passes root-api alias mode to strict topic detail update calls when header is present", async () => {
    mockUpdateTopic.mockResolvedValueOnce({
      id: "topic-1",
      name: "News",
      description: null,
      defaultSubscription: "opt_in",
      visibility: "private",
      createdAt: "2026-05-10T00:00:00.000Z",
    });
    const { PATCH } = await import("@/app/api/topics/[id]/route");

    const response = await PATCH(
      makeNextRequest("http://localhost/api/topics/topic-1", {
        method: "PATCH",
        headers: {
          authorization: "Bearer os_test",
          "content-type": "application/json",
          "x-opensend-root-api-alias": "topics",
        },
        body: JSON.stringify({
          default_subscription: "opt_in",
          visibility: "private",
        }),
      }) as never,
      { params: Promise.resolve({ id: "topic-1" }) },
    );

    expect(response.status).toBe(200);
    expect(mockUpdateTopic).toHaveBeenCalledWith({
      userId: "user-1",
      id: "topic-1",
      body: {
        default_subscription: "opt_in",
        visibility: "private",
      },
      mode: "root",
    });
  });

  it("passes root-api alias mode to strict property detail update calls when header is present", async () => {
    mockUpdateProperty.mockResolvedValueOnce({
      id: "prop-1",
      key: "company",
      name: "Company",
      type: "number",
      fallback_value: null,
      created_at: "2026-05-10T00:00:00.000Z",
      updated_at: "2026-05-10T00:00:00.000Z",
    });
    const { PATCH } = await import("@/app/api/properties/[id]/route");

    const response = await PATCH(
      makeNextRequest("http://localhost/api/properties/prop-1", {
        method: "PATCH",
        headers: {
          authorization: "Bearer os_test",
          "content-type": "application/json",
          "x-opensend-root-api-alias": "contact-properties",
        },
        body: JSON.stringify({ type: "number" }),
      }) as never,
      { params: Promise.resolve({ id: "prop-1" }) },
    );

    expect(response.status).toBe(200);
    expect(mockUpdateProperty).toHaveBeenCalledWith({
      userId: "user-1",
      id: "prop-1",
      body: {
        type: "number",
      },
      mode: "root",
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
        headers: { authorization: "Bearer os_test" },
      }) as never,
      { params: Promise.resolve({ id: "prop-1" }) },
    );

    expect(response.status).toBe(401);
    expect(mockGetProperty).not.toHaveBeenCalled();
  });
});
