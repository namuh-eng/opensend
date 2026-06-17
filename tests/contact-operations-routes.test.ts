import { beforeEach, describe, expect, it, vi } from "vitest";

const mockValidateApiKey = vi.hoisted(() => vi.fn());
const mockBulkAction = vi.hoisted(() => vi.fn());
const mockImportContacts = vi.hoisted(() => vi.fn());
const mockListContactTopics = vi.hoisted(() => vi.fn());
const mockUpdateContactTopics = vi.hoisted(() => vi.fn());

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
  // The import route authenticates with authorizeDashboardOrApiKey (session
  // cookie OR Bearer key). Delegate to the same mock so API-key test setups
  // continue to drive auth; a real session path returns null here.
  authorizeDashboardOrApiKey: (header: string | null | undefined) =>
    mockValidateApiKey(header),
  getServerSession: vi.fn(async () => null),
  unauthorizedResponse: () =>
    Response.json({ error: "Missing or invalid API key" }, { status: 401 }),
}));

vi.mock("@/lib/api-key-permissions", () => ({
  requireFullAccessApiKey: (auth: { permission?: string }) =>
    auth.permission === "full_access"
      ? null
      : Response.json({ error: "Forbidden" }, { status: 403 }),
  requireFullAccessForApiKeyCaller: (auth: {
    permission?: string;
    dashboard?: true;
  }) =>
    auth.dashboard || auth.permission === "full_access"
      ? null
      : Response.json({ error: "Forbidden" }, { status: 403 }),
}));

vi.mock("@opensend/core", () => ({
  ContactOperationsServiceError: MockContactOperationsServiceError,
  createContactOperationsService: () => ({
    bulkAction: mockBulkAction,
    importContacts: mockImportContacts,
    listContactTopics: mockListContactTopics,
    updateContactTopics: mockUpdateContactTopics,
  }),
}));

describe("contact operations route adapters", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockValidateApiKey.mockResolvedValue({
      apiKeyId: "key-1",
      permission: "full_access",
      domain: null,
      userId: "user-1",
    });
  });

  it("keeps /api/contacts/bulk auth in the route and delegates body/user to the service", async () => {
    mockBulkAction.mockResolvedValueOnce({
      object: "bulk_action",
      success: true,
      count: 1,
    });

    const route = await import("@/app/api/contacts/bulk/route");
    const response = await route.POST(
      makeRequest("http://localhost/api/contacts/bulk", {
        method: "POST",
        headers: { authorization: "Bearer key" },
        body: JSON.stringify({
          action: "add_to_segment",
          segment_id: "segment-1",
          contact_ids: ["contact-1"],
        }),
      }) as never,
    );

    expect(mockValidateApiKey).toHaveBeenCalledWith("Bearer key");
    expect(mockBulkAction).toHaveBeenCalledWith({
      userId: "user-1",
      body: {
        action: "add_to_segment",
        segment_id: "segment-1",
        contact_ids: ["contact-1"],
      },
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      object: "bulk_action",
      success: true,
      count: 1,
    });
  });

  it("maps bulk service validation and not-found errors to legacy response bodies", async () => {
    mockBulkAction.mockRejectedValueOnce(
      new MockContactOperationsServiceError(
        "invalid_input",
        "contact_ids must be a non-empty array",
        422,
      ),
    );

    const route = await import("@/app/api/contacts/bulk/route");
    const validationResponse = await route.POST(
      makeRequest("http://localhost/api/contacts/bulk", {
        method: "POST",
        headers: { authorization: "Bearer key" },
        body: JSON.stringify({ action: "add_to_segment" }),
      }) as never,
    );

    expect(validationResponse.status).toBe(422);
    await expect(validationResponse.json()).resolves.toEqual({
      error: "contact_ids must be a non-empty array",
    });

    mockBulkAction.mockRejectedValueOnce(
      new MockContactOperationsServiceError(
        "not_found",
        "Segment not found",
        404,
      ),
    );
    const notFoundResponse = await route.POST(
      makeRequest("http://localhost/api/contacts/bulk", {
        method: "POST",
        headers: { authorization: "Bearer key" },
        body: JSON.stringify({
          action: "add_to_segment",
          segment_id: "missing",
          contact_ids: ["contact-1"],
        }),
      }) as never,
    );

    expect(notFoundResponse.status).toBe(404);
    await expect(notFoundResponse.json()).resolves.toEqual({
      error: "Segment not found",
    });
  });

  it("keeps import form-data and CSV parsing in the route while delegating mapped rows", async () => {
    mockImportContacts.mockResolvedValueOnce({
      object: "import",
      created_count: 2,
      ids: ["contact-1", "contact-2"],
    });
    const formData = {
      get: (key: string) => {
        if (key === "file") {
          return { text: async () => "Email,Plan\nA@Example.com,pro\n" };
        }
        if (key === "mapping") {
          return JSON.stringify({ Email: "email", Plan: "plan" });
        }
        if (key === "segment_id") return "segment-1";
        return null;
      },
    };

    const route = await import("@/app/api/contacts/import/route");
    const response = await route.POST({
      headers: new Headers({ authorization: "Bearer key" }),
      formData: async () => formData,
    } as never);

    expect(mockImportContacts).toHaveBeenCalledWith({
      userId: "user-1",
      rows: [{ Email: "A@Example.com", Plan: "pro" }],
      mapping: { Email: "email", Plan: "plan" },
      segmentId: "segment-1",
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      object: "import",
      created_count: 2,
      ids: ["contact-1", "contact-2"],
    });
  });

  it("returns the legacy import 400 before delegating when no file is provided", async () => {
    const route = await import("@/app/api/contacts/import/route");
    const response = await route.POST({
      headers: new Headers({ authorization: "Bearer key" }),
      formData: async () => new FormData(),
    } as never);

    expect(mockImportContacts).not.toHaveBeenCalled();
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "No file provided",
    });
  });

  it("delegates contact topic listing and preserves the public response shape", async () => {
    mockListContactTopics.mockResolvedValueOnce({
      object: "list",
      data: [{ id: "topic-1", name: "News", subscription: "opt_in" }],
    });

    const route = await import("@/app/api/contacts/[id]/topics/route");
    const response = await route.GET(
      makeRequest("http://localhost/api/contacts/contact-1/topics", {
        headers: { authorization: "Bearer key" },
      }) as never,
      { params: Promise.resolve({ id: "contact-1" }) },
    );

    expect(mockListContactTopics).toHaveBeenCalledWith({
      idOrEmail: "contact-1",
      userId: "user-1",
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      object: "list",
      data: [{ id: "topic-1", name: "News", subscription: "opt_in" }],
    });
  });

  it("passes a deferred JSON body reader to topic updates and maps validation errors", async () => {
    mockUpdateContactTopics.mockImplementationOnce(
      async (input: {
        idOrEmail: string;
        userId: string;
        body: () => Promise<unknown>;
      }) => {
        expect(input.idOrEmail).toBe("contact-1");
        expect(input.userId).toBe("user-1");
        await expect(input.body()).resolves.toEqual({ topics: "nope" });
        throw new MockContactOperationsServiceError(
          "invalid_input",
          "topics must be an array",
          422,
        );
      },
    );

    const route = await import("@/app/api/contacts/[id]/topics/route");
    const response = await route.PATCH(
      makeRequest("http://localhost/api/contacts/contact-1/topics", {
        method: "PATCH",
        headers: { authorization: "Bearer key" },
        body: JSON.stringify({ topics: "nope" }),
      }) as never,
      { params: Promise.resolve({ id: "contact-1" }) },
    );

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({
      error: "topics must be an array",
    });
  });
});
