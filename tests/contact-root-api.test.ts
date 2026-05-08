import { beforeEach, describe, expect, it, vi } from "vitest";

const mockAuthorizeDashboardOrApiKey = vi.hoisted(() => vi.fn());
const mockGetServerSession = vi.hoisted(() => vi.fn());
const mockValidateApiKey = vi.hoisted(() => vi.fn());
const mockContactFindFirst = vi.hoisted(() => vi.fn());
const mockSelect = vi.hoisted(() => vi.fn());
const mockInsert = vi.hoisted(() => vi.fn());
const mockUpdate = vi.hoisted(() => vi.fn());
const mockDelete = vi.hoisted(() => vi.fn());
const mockQueueEvent = vi.hoisted(() => vi.fn());

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
  set: ReturnType<typeof vi.fn>;
  values: ReturnType<typeof vi.fn>;
  returning: ReturnType<typeof vi.fn>;
  then: (resolve: (value: T[]) => unknown) => Promise<unknown>;
};

function makeChain<T>(rows: T[]): Chain<T> {
  const chain = {
    from: vi.fn(() => chain),
    where: vi.fn(() => chain),
    orderBy: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    set: vi.fn(() => chain),
    values: vi.fn(() => chain),
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

vi.mock("@/lib/db", () => ({
  db: {
    query: {
      contacts: { findFirst: mockContactFindFirst },
      segments: { findFirst: vi.fn() },
      topics: { findFirst: vi.fn() },
    },
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
  },
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
    const insertedContact = {
      id: "contact-1",
      email: "user@example.com",
      firstName: "User",
      lastName: "One",
      unsubscribed: false,
      customProperties: { plan: "pro" },
      segments: null,
      topicSubscriptions: null,
      createdAt,
      document: null,
      userId: "user-1",
    };
    const updatedContact = {
      ...insertedContact,
      unsubscribed: true,
    };

    mockInsert.mockReturnValueOnce(makeChain([insertedContact]));
    mockSelect.mockReturnValueOnce(makeChain([insertedContact]));
    mockContactFindFirst
      .mockResolvedValueOnce(insertedContact)
      .mockResolvedValueOnce(insertedContact)
      .mockResolvedValueOnce(updatedContact);
    mockUpdate.mockReturnValueOnce(makeChain([updatedContact]));
    mockDelete.mockReturnValueOnce(
      makeChain([{ id: "contact-1", email: "user@example.com" }]),
    );

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
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockDelete).toHaveBeenCalledTimes(1);
  });

  it("returns 404 for root email lookups outside the caller tenant", async () => {
    mockContactFindFirst.mockResolvedValueOnce(null);

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
  });
});
