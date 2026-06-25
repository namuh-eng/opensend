import { beforeEach, describe, expect, it, vi } from "vitest";

const mockValidateApiKey = vi.hoisted(() => vi.fn());
const mockAuthorizeDashboardOrApiKey = vi.hoisted(() => vi.fn());
const mockGetServerSession = vi.hoisted(() => vi.fn());
const mockRequireFullAccessApiKey = vi.hoisted(() => vi.fn());
const mockRequireFullAccessForApiKeyCaller = vi.hoisted(() => vi.fn());
const mockContactService = vi.hoisted(() => ({
  listContactSegments: vi.fn(),
  addContactToSegment: vi.fn(),
  removeContactFromSegment: vi.fn(),
}));
const mockContactOperationsService = vi.hoisted(() => ({
  listContactTopics: vi.fn(),
  updateContactTopics: vi.fn(),
}));

const MockContactServiceError = vi.hoisted(
  () =>
    class ContactServiceError extends Error {
      constructor(
        readonly code: "duplicate_email" | "not_found",
        message: string,
      ) {
        super(message);
        this.name = "ContactServiceError";
      }
    },
);

const MockContactOperationsServiceError = vi.hoisted(
  () =>
    class ContactOperationsServiceError extends Error {
      constructor(
        readonly code: "invalid_input" | "not_found",
        message: string,
        readonly status: number,
      ) {
        super(message);
        this.name = "ContactOperationsServiceError";
      }
    },
);

function makeRequest(url: string, init?: RequestInit) {
  const request = new Request(url, init) as Request & { nextUrl: URL };
  request.nextUrl = new URL(url);
  return request;
}

vi.mock("@/lib/api-auth", () => ({
  validateApiKey: mockValidateApiKey,
  authorizeDashboardOrApiKey: mockAuthorizeDashboardOrApiKey,
  getServerSession: mockGetServerSession,
  unauthorizedResponse: () =>
    Response.json({ error: "Missing or invalid API key" }, { status: 401 }),
}));

vi.mock("@/lib/api-key-permissions", () => ({
  requireFullAccessApiKey: mockRequireFullAccessApiKey,
  requireFullAccessForApiKeyCaller: mockRequireFullAccessForApiKeyCaller,
}));

vi.mock("@opensend/core", () => ({
  ContactServiceError: MockContactServiceError,
  ContactOperationsServiceError: MockContactOperationsServiceError,
  createContactService: () => mockContactService,
  createContactOperationsService: () => mockContactOperationsService,
}));

describe("root contact relationship API route adapters", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockValidateApiKey.mockResolvedValue({
      apiKeyId: "key-1",
      permission: "full_access",
      domain: null,
      userId: "user-1",
    });
    mockAuthorizeDashboardOrApiKey.mockResolvedValue({
      apiKeyId: "key-1",
      permission: "full_access",
      domain: null,
      userId: "user-1",
    });
    mockRequireFullAccessApiKey.mockReturnValue(null);
    mockRequireFullAccessForApiKeyCaller.mockReturnValue(null);
  });

  it("lists, adds, and removes contact segments at root paths", async () => {
    mockContactService.listContactSegments.mockResolvedValueOnce([
      {
        id: "segment-1",
        name: "Newsletter",
        created_at: "2026-06-08T00:00:00.000Z",
      },
    ]);
    mockContactService.addContactToSegment.mockResolvedValueOnce({
      contactId: "contact-1",
      segmentId: "segment-1",
    });
    mockContactService.removeContactFromSegment.mockResolvedValueOnce({
      contactId: "contact-1",
      segmentId: "segment-1",
    });

    const segmentListRoute = await import(
      "@/app/contacts/[contact_id]/segments/route"
    );
    const segmentMutationRoute = await import(
      "@/app/contacts/[contact_id]/segments/[segment_id]/route"
    );

    const listResponse = await segmentListRoute.GET(
      makeRequest("http://localhost/contacts/contact-1/segments", {
        headers: { authorization: "Bearer os_test" },
      }) as never,
      { params: Promise.resolve({ contact_id: "contact-1" }) },
    );
    expect(listResponse.status).toBe(200);
    await expect(listResponse.json()).resolves.toEqual({
      object: "list",
      data: [
        {
          id: "segment-1",
          name: "Newsletter",
          created_at: "2026-06-08T00:00:00.000Z",
        },
      ],
      has_more: false,
    });
    expect(mockContactService.listContactSegments).toHaveBeenCalledWith(
      "contact-1",
      "user-1",
    );

    const addResponse = await segmentMutationRoute.POST(
      makeRequest("http://localhost/contacts/contact-1/segments/segment-1", {
        method: "POST",
        headers: { authorization: "Bearer os_test" },
      }) as never,
      {
        params: Promise.resolve({
          contact_id: "contact-1",
          segment_id: "segment-1",
        }),
      },
    );
    expect(addResponse.status).toBe(200);
    await expect(addResponse.json()).resolves.toEqual({
      object: "contact_segment",
      contact_id: "contact-1",
      segment_id: "segment-1",
      added: true,
    });
    expect(mockContactService.addContactToSegment).toHaveBeenCalledWith({
      idOrEmail: "contact-1",
      segmentId: "segment-1",
      userId: "user-1",
    });

    const deleteResponse = await segmentMutationRoute.DELETE(
      makeRequest("http://localhost/contacts/contact-1/segments/segment-1", {
        method: "DELETE",
        headers: { authorization: "Bearer os_test" },
      }) as never,
      {
        params: Promise.resolve({
          contact_id: "contact-1",
          segment_id: "segment-1",
        }),
      },
    );
    expect(deleteResponse.status).toBe(200);
    await expect(deleteResponse.json()).resolves.toEqual({
      object: "contact_segment",
      contact_id: "contact-1",
      segment_id: "segment-1",
      deleted: true,
    });
    expect(mockContactService.removeContactFromSegment).toHaveBeenCalledWith({
      idOrEmail: "contact-1",
      segmentId: "segment-1",
      userId: "user-1",
    });
  });

  it("gets and updates contact topics at root paths", async () => {
    mockContactOperationsService.listContactTopics.mockResolvedValueOnce({
      object: "list",
      data: [{ id: "topic-1", name: "Product", subscription: "opt_in" }],
    });
    mockContactOperationsService.updateContactTopics.mockImplementationOnce(
      async (input: {
        idOrEmail: string;
        userId: string;
        body: () => Promise<unknown>;
      }) => {
        expect(input.idOrEmail).toBe("contact-1");
        expect(input.userId).toBe("user-1");
        await expect(input.body()).resolves.toEqual({
          topics: [{ id: "topic-1", subscription: "opt_out" }],
        });
        return {
          object: "contact_topics",
          contact_id: "contact-1",
          updated: true,
        };
      },
    );

    const topicsRoute = await import(
      "@/app/contacts/[contact_id]/topics/route"
    );

    const getResponse = await topicsRoute.GET(
      makeRequest("http://localhost/contacts/contact-1/topics", {
        headers: { authorization: "Bearer os_test" },
      }) as never,
      { params: Promise.resolve({ contact_id: "contact-1" }) },
    );
    expect(getResponse.status).toBe(200);
    await expect(getResponse.json()).resolves.toEqual({
      object: "list",
      data: [{ id: "topic-1", name: "Product", subscription: "opt_in" }],
    });
    expect(mockContactOperationsService.listContactTopics).toHaveBeenCalledWith(
      {
        idOrEmail: "contact-1",
        userId: "user-1",
      },
    );

    const patchResponse = await topicsRoute.PATCH(
      makeRequest("http://localhost/contacts/contact-1/topics", {
        method: "PATCH",
        headers: {
          authorization: "Bearer os_test",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          topics: [{ id: "topic-1", subscription: "opt_out" }],
        }),
      }) as never,
      { params: Promise.resolve({ contact_id: "contact-1" }) },
    );
    expect(patchResponse.status).toBe(200);
    await expect(patchResponse.json()).resolves.toEqual({
      object: "contact_topics",
      contact_id: "contact-1",
      updated: true,
    });
  });

  it("keeps root contact relationship routes API-key-only and full-access gated", async () => {
    mockValidateApiKey.mockResolvedValueOnce(null);
    const { GET } = await import("@/app/contacts/[contact_id]/segments/route");

    const unauthorizedResponse = await GET(
      makeRequest("http://localhost/contacts/contact-1/segments") as never,
      { params: Promise.resolve({ contact_id: "contact-1" }) },
    );
    expect(unauthorizedResponse.status).toBe(401);
    expect(mockContactService.listContactSegments).not.toHaveBeenCalled();

    mockValidateApiKey.mockResolvedValueOnce({
      apiKeyId: "key-2",
      permission: "sending_access",
      domain: null,
      userId: "user-1",
    });
    mockRequireFullAccessForApiKeyCaller.mockReturnValueOnce(
      Response.json({ error: "Forbidden" }, { status: 403 }),
    );

    const forbiddenResponse = await GET(
      makeRequest("http://localhost/contacts/contact-1/segments", {
        headers: { authorization: "Bearer os_test" },
      }) as never,
      { params: Promise.resolve({ contact_id: "contact-1" }) },
    );
    expect(forbiddenResponse.status).toBe(403);
    expect(mockContactService.listContactSegments).not.toHaveBeenCalled();
  });

  it("maps cross-tenant service misses to not-found responses", async () => {
    mockContactService.addContactToSegment.mockRejectedValueOnce(
      new MockContactServiceError("not_found", "Segment not found"),
    );

    const { POST } = await import(
      "@/app/contacts/[contact_id]/segments/[segment_id]/route"
    );
    const response = await POST(
      makeRequest(
        "http://localhost/contacts/contact-1/segments/segment-other",
        {
          method: "POST",
          headers: { authorization: "Bearer os_test" },
        },
      ) as never,
      {
        params: Promise.resolve({
          contact_id: "contact-1",
          segment_id: "segment-other",
        }),
      },
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "Segment not found",
    });
  });
});
