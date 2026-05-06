import { beforeEach, describe, expect, it, vi } from "vitest";

const mockValidateApiKey = vi.hoisted(() => vi.fn());
const mockFindFirst = vi.hoisted(() => vi.fn());
const mockSelect = vi.hoisted(() => vi.fn());
const recordedWhere = vi.hoisted(() => [] as unknown[]);
const mockEq = vi.hoisted(() =>
  vi.fn((left, right) => ({ op: "eq", args: [left, right] })),
);
const mockAnd = vi.hoisted(() => vi.fn((...args) => ({ op: "and", args })));
const mockOr = vi.hoisted(() => vi.fn((...args) => ({ op: "or", args })));
const mockIlike = vi.hoisted(() =>
  vi.fn((left, right) => ({ op: "ilike", args: [left, right] })),
);
const mockGte = vi.hoisted(() =>
  vi.fn((left, right) => ({ op: "gte", args: [left, right] })),
);
const mockLte = vi.hoisted(() =>
  vi.fn((left, right) => ({ op: "lte", args: [left, right] })),
);
const mockGt = vi.hoisted(() =>
  vi.fn((left, right) => ({ op: "gt", args: [left, right] })),
);
const mockLt = vi.hoisted(() =>
  vi.fn((left, right) => ({ op: "lt", args: [left, right] })),
);

vi.mock("@/lib/api-auth", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/api-auth")>("@/lib/api-auth");
  return {
    validateApiKey: mockValidateApiKey,
    unauthorizedResponse: actual.unauthorizedResponse,
  };
});

vi.mock("@/lib/db", () => ({
  db: {
    query: { logs: { findFirst: mockFindFirst } },
    select: mockSelect,
  },
}));

vi.mock("drizzle-orm", async () => {
  const actual = await vi.importActual("drizzle-orm");
  return {
    ...actual,
    and: mockAnd,
    or: mockOr,
    eq: mockEq,
    gt: mockGt,
    gte: mockGte,
    lt: mockLt,
    lte: mockLte,
    ilike: mockIlike,
    desc: vi.fn((column) => ({ op: "desc", column })),
    sql: vi.fn((parts: TemplateStringsArray, ...values: unknown[]) => ({
      op: "sql",
      text: Array.from(parts).join("?"),
      values,
    })),
  };
});

function makeQuery<T>(rows: T[]) {
  const chain = {
    from: vi.fn(() => chain),
    where: vi.fn((condition: unknown) => {
      recordedWhere.push(condition);
      return chain;
    }),
    orderBy: vi.fn(() => chain),
    limit: vi.fn(() => Promise.resolve(rows)),
  };
  return chain;
}

describe("/api/logs", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    recordedWhere.length = 0;
    mockValidateApiKey.mockResolvedValue({
      apiKeyId: "api-key-a",
      permission: "full_access",
      domain: null,
      userId: "user-a",
    });
  });

  it("lists only caller-owned logs and applies search/date/user-agent filters", async () => {
    mockSelect.mockReturnValue(
      makeQuery([
        {
          id: "log-1",
          method: "POST",
          endpoint: "/api/emails",
          status: 200,
          userAgent: "opensend-test",
          apiKeyId: "api-key-a",
          createdAt: new Date("2026-05-06T00:00:00Z"),
        },
      ]),
    );

    const { GET } = await import("@/app/api/logs/route");
    const res = await GET(
      new Request(
        "http://localhost:3015/api/logs?q=email-1&user_agent=test&date_from=2026-05-01&date_to=2026-05-06&api_key_id=api-key-a",
        { headers: { Authorization: "Bearer re_test" } },
      ),
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      object: "list",
      data: [
        {
          id: "log-1",
          endpoint: "/api/emails",
          api_key_id: "api-key-a",
        },
      ],
    });
    expect(mockEq.mock.calls.some(([, right]) => right === "user-a")).toBe(
      true,
    );
    expect(mockEq.mock.calls.some(([, right]) => right === "api-key-a")).toBe(
      true,
    );
    expect(mockIlike).toHaveBeenCalledWith(expect.anything(), "%test%");
    expect(mockGte).toHaveBeenCalled();
    expect(mockLte).toHaveBeenCalled();
    expect(mockOr).toHaveBeenCalled();
  });

  it("returns 404 for another tenant's log detail", async () => {
    mockFindFirst.mockResolvedValue(null);

    const { GET } = await import("@/app/api/logs/[id]/route");
    const res = await GET(
      new Request("http://localhost:3015/api/logs/log-b", {
        headers: { Authorization: "Bearer re_test" },
      }),
      { params: Promise.resolve({ id: "log-b" }) },
    );

    expect(res.status).toBe(404);
    expect(mockFindFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({
        op: "and",
        args: expect.arrayContaining([
          expect.objectContaining({
            op: "eq",
            args: expect.arrayContaining(["log-b"]),
          }),
          expect.objectContaining({
            op: "eq",
            args: expect.arrayContaining(["user-a"]),
          }),
        ]),
      }),
    });
  });
});
