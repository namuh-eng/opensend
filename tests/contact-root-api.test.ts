import { beforeEach, describe, expect, it, vi } from "vitest";

const mockAuthorizeDashboardOrApiKey = vi.hoisted(() => vi.fn());
const mockGetServerSession = vi.hoisted(() => vi.fn());
const mockValidateApiKey = vi.hoisted(() => vi.fn());
const mockQueueEvent = vi.hoisted(() => vi.fn());
const mockContactService = vi.hoisted(() => ({
  createContact: vi.fn(),
  listContacts: vi.fn(),
  getContact: vi.fn(),
  updateContact: vi.fn(),
  deleteContact: vi.fn(),
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

vi.mock("@/lib/events", () => ({
  queueEvent: mockQueueEvent,
}));

vi.mock("@opensend/core", () => ({
  ContactServiceError: MockContactServiceError,
  createContactService: () => mockContactService,
  resolveBillingEntitlement: vi.fn(async () => ({
    mode: "self_host" as const,
  })),
}));

describe("Resend-compatible root contacts API", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    const auth = {
      apiKeyId: "key-1",
      permission: "full_access",
      domain: null,
      userId: "user-1",
    };
    mockAuthorizeDashboardOrApiKey.mockResolvedValue(auth);
    mockValidateApiKey.mockResolvedValue(auth);
    mockGetServerSession.mockResolvedValue(null);
    mockQueueEvent.mockResolvedValue({ eventId: "event-1", deliveryIds: [] });
  });

  it("creates, lists, retrieves, updates, and deletes contacts at /contacts", async () => {
    const createdAt = new Date("2026-05-08T00:00:00.000Z");
    mockContactService.createContact.mockResolvedValueOnce({
      object: "contact",
      id: "contact-1",
      email: "user@example.com",
      webhookPayload: {
        id: "contact-1",
        email: "user@example.com",
        first_name: "User",
        last_name: "One",
        unsubscribed: false,
        properties: { plan: "pro" },
        segments: [],
        topics: [],
        created_at: createdAt.toISOString(),
      },
    });
    mockContactService.listContacts.mockResolvedValueOnce({
      hasMore: false,
      data: [
        {
          id: "contact-1",
          email: "user@example.com",
          first_name: "User",
          last_name: "One",
          firstName: "User",
          lastName: "One",
          unsubscribed: false,
          status: "subscribed",
          segments: [],
          created_at: createdAt,
        },
      ],
    });
    mockContactService.getContact.mockResolvedValueOnce({
      object: "contact",
      id: "contact-1",
      email: "user@example.com",
      first_name: "User",
      last_name: "One",
      unsubscribed: false,
      properties: { plan: "pro" },
      segments: [],
      topics: [],
      created_at: createdAt,
    });
    mockContactService.updateContact.mockResolvedValueOnce({
      object: "contact",
      id: "contact-1",
      email: "user@example.com",
      first_name: "User",
      last_name: "One",
      unsubscribed: true,
      properties: { plan: "pro" },
      created_at: createdAt,
      changedFields: ["unsubscribed"],
      webhookPayload: {
        id: "contact-1",
        email: "user@example.com",
        first_name: "User",
        last_name: "One",
        unsubscribed: true,
        properties: { plan: "pro" },
        segments: [],
        topics: [],
        created_at: createdAt.toISOString(),
      },
    });
    mockContactService.deleteContact.mockResolvedValueOnce({
      id: "contact-1",
      email: "user@example.com",
    });

    const collectionRoute = await import("@/app/contacts/route");
    const detailRoute = await import("@/app/contacts/[contact_id]/route");

    const createResponse = await collectionRoute.POST(
      makeRequest("http://localhost/contacts", {
        method: "POST",
        headers: {
          authorization: "Bearer key",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          email: "USER@EXAMPLE.COM",
          first_name: "User",
          last_name: "One",
          properties: { plan: "pro" },
        }),
      }) as never,
    );
    await expect(createResponse.json()).resolves.toEqual({
      object: "contact",
      id: "contact-1",
    });
    expect(createResponse.status).toBe(201);
    expect(mockContactService.createContact).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        email: "USER@EXAMPLE.COM",
        firstName: "User",
      }),
    );

    const listResponse = await collectionRoute.GET(
      makeRequest("http://localhost/contacts", {
        headers: { authorization: "Bearer key" },
      }),
    );
    await expect(listResponse.json()).resolves.toMatchObject({
      object: "list",
      has_more: false,
      data: [
        {
          id: "contact-1",
          email: "user@example.com",
          first_name: "User",
          last_name: "One",
          unsubscribed: false,
          status: "subscribed",
        },
      ],
    });

    const getResponse = await detailRoute.GET(
      makeRequest("http://localhost/contacts/user@example.com", {
        headers: { authorization: "Bearer key" },
      }),
      { params: Promise.resolve({ contact_id: "user@example.com" }) },
    );
    await expect(getResponse.json()).resolves.toMatchObject({
      object: "contact",
      id: "contact-1",
      email: "user@example.com",
    });

    const updateResponse = await detailRoute.PATCH(
      makeRequest("http://localhost/contacts/user@example.com", {
        method: "PATCH",
        headers: { authorization: "Bearer key" },
        body: JSON.stringify({ unsubscribed: true }),
      }),
      { params: Promise.resolve({ contact_id: "user@example.com" }) },
    );
    await expect(updateResponse.json()).resolves.toMatchObject({
      object: "contact",
      id: "contact-1",
      unsubscribed: true,
    });

    const deleteResponse = await detailRoute.DELETE(
      makeRequest("http://localhost/contacts/contact-1", {
        method: "DELETE",
        headers: { authorization: "Bearer key" },
      }),
      { params: Promise.resolve({ contact_id: "contact-1" }) },
    );
    await expect(deleteResponse.json()).resolves.toEqual({
      object: "contact",
      id: "contact-1",
      deleted: true,
    });

    expect(mockQueueEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "contact.created", userId: "user-1" }),
    );
    expect(mockQueueEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "contact.updated", userId: "user-1" }),
    );
    expect(mockQueueEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "contact.deleted", userId: "user-1" }),
    );
  });

  it("returns 404 for root email lookups outside the caller tenant", async () => {
    mockContactService.getContact.mockRejectedValueOnce(
      new MockContactServiceError("not_found", "Contact not found"),
    );

    const detailRoute = await import("@/app/contacts/[contact_id]/route");
    const response = await detailRoute.GET(
      makeRequest("http://localhost/contacts/other@example.com", {
        headers: { authorization: "Bearer key" },
      }),
      { params: Promise.resolve({ contact_id: "other@example.com" }) },
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "Contact not found",
    });
    expect(mockContactService.getContact).toHaveBeenCalledWith(
      "other@example.com",
      "user-1",
    );
  });

  it("keeps root contact detail aliases API-key-only while preserving dashboard /api contact detail access", async () => {
    const createdAt = new Date("2026-05-08T00:00:00.000Z");
    mockValidateApiKey.mockResolvedValue(null);
    mockAuthorizeDashboardOrApiKey.mockResolvedValueOnce({ dashboard: true });
    mockGetServerSession.mockResolvedValueOnce({
      user: { id: "dashboard-user" },
    });
    mockContactService.getContact.mockResolvedValueOnce({
      object: "contact",
      id: "contact-1",
      email: "user@example.com",
      first_name: "User",
      last_name: "One",
      unsubscribed: false,
      properties: null,
      segments: [],
      topics: [],
      created_at: createdAt,
    });

    const rootRoute = await import("@/app/contacts/[contact_id]/route");
    const apiRoute = await import("@/app/api/contacts/[id]/route");

    const rootResponse = await rootRoute.GET(
      makeRequest("http://localhost/contacts/contact-1"),
      { params: Promise.resolve({ contact_id: "contact-1" }) },
    );
    expect(rootResponse.status).toBe(401);
    const rootPatchResponse = await rootRoute.PATCH(
      makeRequest("http://localhost/contacts/contact-1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ first_name: "Dashboard" }),
      }),
      { params: Promise.resolve({ contact_id: "contact-1" }) },
    );
    expect(rootPatchResponse.status).toBe(401);
    const rootDeleteResponse = await rootRoute.DELETE(
      makeRequest("http://localhost/contacts/contact-1", {
        method: "DELETE",
      }),
      { params: Promise.resolve({ contact_id: "contact-1" }) },
    );
    expect(rootDeleteResponse.status).toBe(401);
    expect(mockAuthorizeDashboardOrApiKey).not.toHaveBeenCalled();
    expect(mockContactService.getContact).not.toHaveBeenCalled();
    expect(mockContactService.updateContact).not.toHaveBeenCalled();
    expect(mockContactService.deleteContact).not.toHaveBeenCalled();

    const apiResponse = await apiRoute.GET(
      makeRequest("http://localhost/api/contacts/contact-1"),
      { params: Promise.resolve({ id: "contact-1" }) },
    );
    expect(apiResponse.status).toBe(200);
    await expect(apiResponse.json()).resolves.toMatchObject({
      object: "contact",
      id: "contact-1",
    });
    expect(mockContactService.getContact).toHaveBeenCalledWith(
      "contact-1",
      "dashboard-user",
    );
  });
});
