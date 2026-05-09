import { beforeEach, describe, expect, it, vi } from "vitest";

const mockValidateApiKey = vi.hoisted(() => vi.fn());
const mockSelect = vi.hoisted(() => vi.fn());
const mockInsert = vi.hoisted(() => vi.fn());
const mockUpdate = vi.hoisted(() => vi.fn());
const mockFindFirst = vi.hoisted(() => vi.fn());

function makeChain<T>(rows: T[]) {
  return {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue(rows),
    // biome-ignore lint/suspicious/noThenProperty: mocks Drizzle's thenable query builder
    then: (resolve: (value: T[]) => unknown) => Promise.resolve(resolve(rows)),
  };
}

vi.mock("@/lib/db", () => ({
  db: {
    query: {
      templates: { findFirst: mockFindFirst },
    },
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
  },
}));

vi.mock("@/lib/api-auth", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/api-auth")>("@/lib/api-auth");
  return {
    ...actual,
    validateApiKey: mockValidateApiKey,
  };
});

vi.mock("drizzle-orm", async () => {
  const actual = await vi.importActual("drizzle-orm");
  return {
    ...actual,
    eq: vi.fn((...args: unknown[]) => ({ op: "eq", args })),
  };
});

function makeRequest(url: string, init?: RequestInit) {
  const request = new Request(url, init) as Request & { nextUrl: URL };
  request.nextUrl = new URL(url);
  return request;
}

describe("template variable metadata APIs", () => {
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

  it("accepts Resend-style variables on create and stores type/fallback metadata", async () => {
    const createdAt = new Date("2026-05-09T00:00:00.000Z");
    const values = vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([
        {
          id: "tmpl-1",
          name: "Receipt",
          alias: "receipt",
          createdAt,
        },
      ]),
    });
    mockInsert.mockReturnValue({ values });

    const { POST } = await import("@/app/api/templates/route");
    const response = await POST(
      makeRequest("http://localhost/api/templates", {
        method: "POST",
        headers: {
          authorization: "Bearer token",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          name: "Receipt",
          subject: "Order {{{PRODUCT}}}",
          html: "<p>{{{PRODUCT}}} costs {{{PRICE}}}</p>",
          variables: [
            { key: "PRODUCT", type: "string", fallbackValue: "item" },
            { key: "PRICE", type: "number", fallback_value: 25 },
            { name: "legacy_name", required: true },
          ],
        }),
      }) as never,
    );

    expect(response.status).toBe(201);
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: [
          {
            name: "PRODUCT",
            key: "PRODUCT",
            type: "string",
            required: false,
            fallbackValue: "item",
          },
          {
            name: "PRICE",
            key: "PRICE",
            type: "number",
            required: false,
            fallbackValue: 25,
          },
          {
            name: "legacy_name",
            key: "legacy_name",
            type: "string",
            required: true,
            fallbackValue: null,
          },
        ],
      }),
    );
  });

  it("preserves reserved-name and 50-variable validation on create", async () => {
    const { POST } = await import("@/app/api/templates/route");

    const reserved = await POST(
      makeRequest("http://localhost/api/templates", {
        method: "POST",
        headers: {
          authorization: "Bearer token",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          name: "Bad",
          html: "<p>Bad</p>",
          variables: [{ key: "EMAIL", type: "string" }],
        }),
      }) as never,
    );
    expect(reserved.status).toBe(422);
    await expect(reserved.json()).resolves.toEqual({
      error: "Variable name EMAIL is reserved.",
    });

    const tooMany = await POST(
      makeRequest("http://localhost/api/templates", {
        method: "POST",
        headers: {
          authorization: "Bearer token",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          name: "Too many",
          html: "<p>Bad</p>",
          variables: Array.from({ length: 51 }, (_, index) => ({
            key: `VAR_${index}`,
            type: "string",
          })),
        }),
      }) as never,
    );
    expect(tooMany.status).toBe(422);
    await expect(tooMany.json()).resolves.toEqual({
      error: "Too many variables. Max allowed is 50.",
    });
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("returns configured fallback_value and legacy variable metadata on detail", async () => {
    const createdAt = new Date("2026-05-09T00:00:00.000Z");
    mockSelect.mockReturnValue(
      makeChain([
        {
          id: "tmpl-1",
          name: "Receipt",
          alias: "receipt",
          status: "draft",
          subject: "Order {{{PRODUCT}}}",
          from: null,
          replyTo: null,
          previewText: null,
          html: "<p>{{{PRODUCT}}}</p>",
          text: "Product: {{{PRODUCT}}}",
          variables: [
            {
              name: "PRODUCT",
              key: "PRODUCT",
              type: "string",
              required: false,
              fallbackValue: "item",
            },
            { name: "legacy_name", required: true },
          ],
          createdAt,
        },
      ]),
    );

    const { GET } = await import("@/app/api/templates/[id]/route");
    const response = await GET(
      makeRequest("http://localhost/api/templates/tmpl-1", {
        headers: { authorization: "Bearer token" },
      }) as never,
      { params: Promise.resolve({ id: "tmpl-1" }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      variables: [
        {
          key: "PRODUCT",
          name: "PRODUCT",
          type: "string",
          required: false,
          fallback_value: "item",
        },
        {
          key: "legacy_name",
          name: "legacy_name",
          type: "string",
          required: true,
          fallback_value: null,
        },
      ],
    });
  });

  it("accepts fallback_value on update and returns normalized metadata", async () => {
    const updatedAt = new Date("2026-05-09T00:00:00.000Z");
    const set = vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([
          {
            id: "tmpl-1",
            name: "Receipt",
            alias: "receipt",
            status: "draft",
            subject: "Order {{{PRODUCT}}}",
            from: null,
            replyTo: null,
            previewText: null,
            html: "<p>{{{PRODUCT}}}</p>",
            text: null,
            variables: [
              {
                name: "PRODUCT",
                key: "PRODUCT",
                type: "string",
                required: false,
                fallbackValue: "item",
              },
            ],
            createdAt: updatedAt,
          },
        ]),
      }),
    });
    mockUpdate.mockReturnValue({ set });

    const { PATCH } = await import("@/app/api/templates/[id]/route");
    const response = await PATCH(
      makeRequest("http://localhost/api/templates/tmpl-1", {
        method: "PATCH",
        headers: {
          authorization: "Bearer token",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          variables: [
            { key: "PRODUCT", type: "string", fallback_value: "item" },
          ],
        }),
      }) as never,
      { params: Promise.resolve({ id: "tmpl-1" }) },
    );

    expect(response.status).toBe(200);
    expect(set).toHaveBeenCalledWith({
      variables: [
        {
          name: "PRODUCT",
          key: "PRODUCT",
          type: "string",
          required: false,
          fallbackValue: "item",
        },
      ],
    });
    await expect(response.json()).resolves.toMatchObject({
      variables: [
        {
          key: "PRODUCT",
          type: "string",
          required: false,
          fallback_value: "item",
        },
      ],
    });
  });
});
