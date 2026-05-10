import { beforeEach, describe, expect, it, vi } from "vitest";

const mockAuthorizeDashboardOrApiKey = vi.hoisted(() => vi.fn());
const mockGetServerSession = vi.hoisted(() => vi.fn());
const mockValidateApiKey = vi.hoisted(() => vi.fn());
const mockContactFindFirst = vi.hoisted(() => vi.fn());
const mockContactFindMany = vi.hoisted(() => vi.fn());
const mockSegmentFindFirst = vi.hoisted(() => vi.fn());
const mockTopicFindFirst = vi.hoisted(() => vi.fn());
const mockSelect = vi.hoisted(() => vi.fn());
const mockInsert = vi.hoisted(() => vi.fn());
const mockUpdate = vi.hoisted(() => vi.fn());
const mockDelete = vi.hoisted(() => vi.fn());
const mockQueueEvent = vi.hoisted(() => vi.fn());
const mockContactService = vi.hoisted(() => ({
  createContact: vi.fn(),
  listContacts: vi.fn(),
  getContact: vi.fn(),
  updateContact: vi.fn(),
  deleteContact: vi.fn(),
}));
const mockContactOperationsService = vi.hoisted(() => ({
  bulkAction: vi.fn(),
  importContacts: vi.fn(),
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

type Chain<T> = {
  from: ReturnType<typeof vi.fn>;
  where: ReturnType<typeof vi.fn>;
  orderBy: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  innerJoin: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
  values: ReturnType<typeof vi.fn>;
  onConflictDoNothing: ReturnType<typeof vi.fn>;
  returning: ReturnType<typeof vi.fn>;
  then: (resolve: (value: T[]) => unknown) => Promise<unknown>;
};

function makeChain<T>(rows: T[]): Chain<T> {
  const chain = {
    from: vi.fn(() => chain),
    where: vi.fn(() => chain),
    orderBy: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    innerJoin: vi.fn(() => chain),
    set: vi.fn(() => chain),
    values: vi.fn(() => chain),
    onConflictDoNothing: vi.fn(() => Promise.resolve()),
    returning: vi.fn(() => Promise.resolve(rows)),
    // biome-ignore lint/suspicious/noThenProperty: mocks Drizzle's thenable query builder
    then: (resolve: (value: T[]) => unknown) => Promise.resolve(resolve(rows)),
  };
  return chain;
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
  ContactOperationsServiceError: MockContactOperationsServiceError,
  createContactService: () => mockContactService,
  createContactOperationsService: () => mockContactOperationsService,
}));

vi.mock("@/lib/db", () => ({
  db: {
    query: {
      contacts: {
        findFirst: mockContactFindFirst,
        findMany: mockContactFindMany,
      },
      segments: { findFirst: mockSegmentFindFirst },
      topics: { findFirst: mockTopicFindFirst },
    },
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
  },
}));

describe("contact API tenant isolation", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
    mockValidateApiKey.mockResolvedValue({
      apiKeyId: "key-b",
      permission: "full_access",
      domain: null,
      userId: "user-b",
    });
    mockAuthorizeDashboardOrApiKey.mockResolvedValue({
      apiKeyId: "key-b",
      permission: "full_access",
      domain: null,
      userId: "user-b",
    });
    mockGetServerSession.mockResolvedValue(null);
    mockQueueEvent.mockResolvedValue({
      eventId: "event-1",
      deliveryIds: ["delivery-1"],
    });
    mockContactService.createContact.mockReset();
    mockContactService.listContacts.mockReset();
    mockContactService.getContact.mockReset();
    mockContactService.updateContact.mockReset();
    mockContactService.deleteContact.mockReset();
    mockContactOperationsService.bulkAction.mockReset();
    mockContactOperationsService.importContacts.mockReset();
    mockContactOperationsService.listContactTopics.mockReset();
    mockContactOperationsService.updateContactTopics.mockReset();
  });

  it("enqueues contact.created for the caller tenant after creating a contact", async () => {
    const insertedContact = {
      id: "contact-b",
      email: "b@example.com",
      firstName: "B",
      lastName: "User",
      unsubscribed: false,
      customProperties: { plan: "pro" },
      segments: null,
      topicSubscriptions: null,
      createdAt: new Date("2026-05-06T00:00:00.000Z"),
      document: null,
      userId: "user-b",
    };
    mockContactService.createContact.mockResolvedValueOnce({
      object: "contact",
      id: insertedContact.id,
      email: insertedContact.email,
      webhookPayload: {
        id: insertedContact.id,
        email: insertedContact.email,
        first_name: insertedContact.firstName,
        last_name: insertedContact.lastName,
        unsubscribed: insertedContact.unsubscribed,
        properties: insertedContact.customProperties,
        segments: [],
        topics: [],
        created_at: insertedContact.createdAt.toISOString(),
      },
    });

    const route = await import("@/app/api/contacts/route");
    const response = await route.POST(
      makeRequest("http://localhost/api/contacts", {
        method: "POST",
        headers: {
          authorization: "Bearer user-b-key",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          email: "B@Example.com",
          first_name: "B",
          last_name: "User",
          properties: { plan: "pro" },
        }),
      }) as never,
    );

    expect(response.status).toBe(201);
    expect(mockContactService.createContact).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "B@Example.com",
        userId: "user-b",
      }),
    );
    expect(mockQueueEvent).toHaveBeenCalledWith({
      type: "contact.created",
      userId: "user-b",
      payload: expect.objectContaining({
        id: "contact-b",
        email: "b@example.com",
        first_name: "B",
        properties: { plan: "pro" },
      }),
    });
  });

  it("enqueues contact.updated only when the caller-owned contact changes", async () => {
    mockContactFindFirst.mockResolvedValueOnce({
      id: "contact-b",
      email: "b@example.com",
      firstName: "Before",
      lastName: null,
      unsubscribed: false,
      customProperties: null,
      segments: null,
      topicSubscriptions: null,
      createdAt: new Date("2026-05-06T00:00:00.000Z"),
      document: null,
      userId: "user-b",
    });
    const updateChain = makeChain([
      {
        id: "contact-b",
        email: "b@example.com",
        firstName: "After",
        lastName: null,
        unsubscribed: false,
        customProperties: null,
        segments: null,
        topicSubscriptions: null,
        createdAt: new Date("2026-05-06T00:00:00.000Z"),
        document: null,
        userId: "user-b",
      },
    ]);
    mockUpdate.mockReturnValueOnce(updateChain);
    mockContactService.updateContact.mockResolvedValueOnce({
      object: "contact",
      id: "contact-b",
      email: "b@example.com",
      first_name: "After",
      last_name: null,
      unsubscribed: false,
      properties: null,
      created_at: new Date("2026-05-06T00:00:00.000Z"),
      changedFields: ["first_name"],
      webhookPayload: {
        id: "contact-b",
        email: "b@example.com",
        first_name: "After",
        last_name: null,
        unsubscribed: false,
        properties: {},
        segments: [],
        topics: [],
        created_at: "2026-05-06T00:00:00.000Z",
      },
    });

    const route = await import("@/app/api/contacts/[id]/route");
    const response = await route.PATCH(
      makeRequest("http://localhost/api/contacts/contact-b", {
        method: "PATCH",
        headers: { authorization: "Bearer user-b-key" },
        body: JSON.stringify({ first_name: "After" }),
      }),
      { params: Promise.resolve({ id: "contact-b" }) },
    );

    expect(response.status).toBe(200);
    expect(mockQueueEvent).toHaveBeenCalledWith({
      type: "contact.updated",
      userId: "user-b",
      payload: expect.objectContaining({
        id: "contact-b",
        changed_fields: ["first_name"],
        contact: expect.objectContaining({ first_name: "After" }),
      }),
    });

    vi.resetAllMocks();
    mockValidateApiKey.mockResolvedValue({
      apiKeyId: "key-b",
      permission: "full_access",
      domain: null,
      userId: "user-b",
    });
    mockContactFindFirst.mockResolvedValueOnce({
      id: "contact-b",
      email: "b@example.com",
      firstName: "After",
      lastName: null,
      unsubscribed: false,
      customProperties: null,
      segments: null,
      topicSubscriptions: null,
      createdAt: new Date("2026-05-06T00:00:00.000Z"),
      document: null,
      userId: "user-b",
    });
    mockContactService.updateContact.mockResolvedValueOnce({
      object: "contact",
      id: "contact-b",
      email: "b@example.com",
      first_name: "After",
      last_name: null,
      unsubscribed: false,
      properties: null,
      created_at: new Date("2026-05-06T00:00:00.000Z"),
      changedFields: [],
      webhookPayload: {
        id: "contact-b",
        email: "b@example.com",
        first_name: "After",
        last_name: null,
        unsubscribed: false,
        properties: {},
        segments: [],
        topics: [],
        created_at: "2026-05-06T00:00:00.000Z",
      },
    });

    const unchanged = await route.PATCH(
      makeRequest("http://localhost/api/contacts/contact-b", {
        method: "PATCH",
        headers: { authorization: "Bearer user-b-key" },
        body: JSON.stringify({ first_name: "After" }),
      }),
      { params: Promise.resolve({ id: "contact-b" }) },
    );

    expect(unchanged.status).toBe(200);
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockQueueEvent).not.toHaveBeenCalled();
  });

  it("enqueues contact.deleted for the caller tenant after deletion", async () => {
    mockContactFindFirst.mockResolvedValueOnce({
      id: "contact-b",
      email: "b@example.com",
      userId: "user-b",
    });
    const deleteChain = makeChain([
      { id: "contact-b", email: "b@example.com" },
    ]);
    mockDelete.mockReturnValueOnce(deleteChain);
    mockContactService.deleteContact.mockResolvedValueOnce({
      id: "contact-b",
      email: "b@example.com",
    });

    const route = await import("@/app/api/contacts/[id]/route");
    const response = await route.DELETE(
      makeRequest("http://localhost/api/contacts/contact-b", {
        method: "DELETE",
        headers: { authorization: "Bearer user-b-key" },
      }),
      { params: Promise.resolve({ id: "contact-b" }) },
    );

    expect(response.status).toBe(200);
    expect(mockQueueEvent).toHaveBeenCalledWith({
      type: "contact.deleted",
      userId: "user-b",
      payload: { id: "contact-b", email: "b@example.com" },
    });
  });

  it("returns an empty contact list scoped to the caller user", async () => {
    const listChain = makeChain([]);
    mockSelect.mockReturnValueOnce(listChain);
    mockContactService.listContacts.mockResolvedValueOnce({
      data: [],
      hasMore: false,
    });

    const route = await import("@/app/api/contacts/route");
    const response = await route.GET(
      makeRequest("http://localhost/api/contacts", {
        headers: { authorization: "Bearer user-b-key" },
      }),
    );

    await expect(response.json()).resolves.toMatchObject({
      object: "list",
      data: [],
      has_more: false,
    });
    expect(response.status).toBe(200);
    expect(mockContactService.listContacts).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-b" }),
    );
  });

  it("returns 404 when user B requests user A's contact detail", async () => {
    mockContactFindFirst.mockResolvedValueOnce(null);
    mockContactService.getContact.mockRejectedValueOnce(
      new MockContactServiceError("not_found", "Contact not found"),
    );

    const route = await import("@/app/api/contacts/[id]/route");
    const response = await route.GET(
      makeRequest("http://localhost/api/contacts/contact-a", {
        headers: { authorization: "Bearer user-b-key" },
      }),
      { params: Promise.resolve({ id: "contact-a" }) },
    );

    await expect(response.json()).resolves.toEqual({
      error: "Contact not found",
    });
    expect(response.status).toBe(404);
    expect(mockContactService.getContact).toHaveBeenCalledWith(
      "contact-a",
      "user-b",
    );
  });

  it("does not update user A's contact when called as user B", async () => {
    mockContactFindFirst.mockResolvedValueOnce(null);
    mockContactService.updateContact.mockRejectedValueOnce(
      new MockContactServiceError("not_found", "Contact not found"),
    );

    const route = await import("@/app/api/contacts/[id]/route");
    const response = await route.PATCH(
      makeRequest("http://localhost/api/contacts/contact-a", {
        method: "PATCH",
        headers: { authorization: "Bearer user-b-key" },
        body: JSON.stringify({ first_name: "Mallory" }),
      }),
      { params: Promise.resolve({ id: "contact-a" }) },
    );

    expect(response.status).toBe(404);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("does not delete user A's contact when called as user B", async () => {
    mockContactFindFirst.mockResolvedValueOnce(null);
    mockContactService.deleteContact.mockRejectedValueOnce(
      new MockContactServiceError("not_found", "Contact not found"),
    );

    const route = await import("@/app/api/contacts/[id]/route");
    const response = await route.DELETE(
      makeRequest("http://localhost/api/contacts/contact-a", {
        method: "DELETE",
        headers: { authorization: "Bearer user-b-key" },
      }),
      { params: Promise.resolve({ id: "contact-a" }) },
    );

    expect(response.status).toBe(404);
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("does not bulk-mutate contacts outside the caller tenant", async () => {
    mockContactOperationsService.bulkAction.mockResolvedValueOnce({
      object: "bulk_action",
      success: true,
      count: 0,
    });

    const route = await import("@/app/api/contacts/bulk/route");
    const response = await route.POST(
      makeRequest("http://localhost/api/contacts/bulk", {
        method: "POST",
        headers: { authorization: "Bearer user-b-key" },
        body: JSON.stringify({
          action: "add_to_segment",
          segment_id: "seg-b",
          contact_ids: ["contact-a"],
        }),
      }) as never,
    );

    await expect(response.json()).resolves.toMatchObject({
      object: "bulk_action",
      success: true,
      count: 0,
    });
    expect(mockContactOperationsService.bulkAction).toHaveBeenCalledWith({
      userId: "user-b",
      body: {
        action: "add_to_segment",
        segment_id: "seg-b",
        contact_ids: ["contact-a"],
      },
    });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("stamps imported contacts with the caller user", async () => {
    mockContactOperationsService.importContacts.mockResolvedValueOnce({
      object: "import",
      created_count: 1,
      ids: ["contact-b"],
    });

    const formData = {
      get: (key: string) => {
        if (key === "file")
          return { text: async () => "Email\nb@example.com\n" };
        if (key === "mapping") return JSON.stringify({ Email: "email" });
        return null;
      },
    };

    const route = await import("@/app/api/contacts/import/route");
    const response = await route.POST({
      headers: new Headers({ authorization: "Bearer user-b-key" }),
      formData: async () => formData,
    } as never);

    expect(response.status).toBe(200);
    expect(mockContactOperationsService.importContacts).toHaveBeenCalledWith({
      userId: "user-b",
      rows: [{ Email: "b@example.com" }],
      mapping: { Email: "email" },
      segmentId: null,
    });
  });

  it("rejects contact routes when the caller user cannot be resolved", async () => {
    mockValidateApiKey.mockResolvedValueOnce({
      apiKeyId: "legacy-key",
      permission: "full_access",
      domain: null,
      userId: null,
    });

    const route = await import("@/app/api/contacts/[id]/route");
    const response = await route.GET(
      makeRequest("http://localhost/api/contacts/contact-a", {
        headers: { authorization: "Bearer legacy-key" },
      }),
      { params: Promise.resolve({ id: "contact-a" }) },
    );

    expect(response.status).toBe(401);
    expect(mockContactFindFirst).not.toHaveBeenCalled();
  });
});
