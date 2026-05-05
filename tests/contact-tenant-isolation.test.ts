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

function expressionContains(value: unknown, expected: string): boolean {
  const seen = new Set<object>();

  function visit(node: unknown): boolean {
    if (node === expected) return true;
    if (typeof node === "string") return node.includes(expected);
    if (!node || typeof node !== "object") return false;
    if (seen.has(node)) return false;
    seen.add(node);

    for (const key of Reflect.ownKeys(node)) {
      const child = (node as Record<PropertyKey, unknown>)[key];
      if (visit(child)) return true;
    }

    return false;
  }

  return visit(value);
}

vi.mock("@/lib/api-auth", () => ({
  authorizeDashboardOrApiKey: mockAuthorizeDashboardOrApiKey,
  getServerSession: mockGetServerSession,
  validateApiKey: mockValidateApiKey,
  unauthorizedResponse: () =>
    Response.json({ error: "Missing or invalid API key" }, { status: 401 }),
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
    vi.clearAllMocks();
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
  });

  it("returns an empty contact list scoped to the caller user", async () => {
    const listChain = makeChain([]);
    mockSelect.mockReturnValueOnce(listChain);

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
    expect(
      expressionContains(listChain.where.mock.calls[0]?.[0], "user_id"),
    ).toBe(true);
    expect(
      expressionContains(listChain.where.mock.calls[0]?.[0], "user-b"),
    ).toBe(true);
  });

  it("returns 404 when user B requests user A's contact detail", async () => {
    mockContactFindFirst.mockResolvedValueOnce(null);

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
    expect(
      expressionContains(
        mockContactFindFirst.mock.calls[0]?.[0]?.where,
        "user_id",
      ),
    ).toBe(true);
    expect(
      expressionContains(
        mockContactFindFirst.mock.calls[0]?.[0]?.where,
        "user-b",
      ),
    ).toBe(true);
  });

  it("does not update user A's contact when called as user B", async () => {
    mockContactFindFirst.mockResolvedValueOnce(null);

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
    mockSegmentFindFirst.mockResolvedValueOnce({ id: "seg-b", name: "VIP" });
    mockContactFindMany.mockResolvedValueOnce([]);

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
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(
      expressionContains(
        mockContactFindMany.mock.calls[0]?.[0]?.where,
        "user_id",
      ),
    ).toBe(true);
    expect(
      expressionContains(
        mockContactFindMany.mock.calls[0]?.[0]?.where,
        "user-b",
      ),
    ).toBe(true);
  });

  it("stamps imported contacts with the caller user", async () => {
    mockContactFindFirst.mockResolvedValueOnce(null);
    const insertChain = makeChain([{ id: "contact-b" }]);
    mockInsert.mockReturnValueOnce(insertChain);

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
    expect(insertChain.values.mock.calls[0]?.[0]).toMatchObject({
      email: "b@example.com",
      userId: "user-b",
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
