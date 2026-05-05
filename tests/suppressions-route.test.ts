import { beforeEach, describe, expect, it, vi } from "vitest";

const mockAuthorizeDashboardOrApiKey = vi.hoisted(() => vi.fn());
const mockGetServerSession = vi.hoisted(() => vi.fn());
const mockRemoveSuppression = vi.hoisted(() => vi.fn());
const mockListSuppressions = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-auth", () => ({
  authorizeDashboardOrApiKey: mockAuthorizeDashboardOrApiKey,
  getServerSession: mockGetServerSession,
  unauthorizedResponse: () =>
    Response.json({ error: "Missing or invalid API key" }, { status: 401 }),
}));

vi.mock("@/lib/suppressions", () => ({
  listSuppressions: mockListSuppressions,
  removeSuppression: mockRemoveSuppression,
  serializeSuppression: (row: {
    id: string;
    email: string;
    reason: string;
  }) => ({
    id: row.id,
    object: "suppression",
    email: row.email,
    reason: row.reason,
    scope: "user",
  }),
}));

describe("suppression management routes", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockAuthorizeDashboardOrApiKey.mockResolvedValue({
      apiKeyId: "key-1",
      permission: "full_access",
      domain: null,
      userId: "user-1",
    });
  });

  it("lists user-scoped suppression records", async () => {
    mockListSuppressions.mockResolvedValue({
      data: [{ id: "supp-1", email: "blocked@test.com", reason: "bounced" }],
      hasMore: false,
    });

    const { GET } = await import("@/app/api/suppressions/route");
    const res = await GET(
      new Request("http://localhost:3015/api/suppressions?limit=10", {
        headers: { Authorization: "Bearer re_test" },
      }),
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      object: "list",
      scope: "user",
      data: [
        {
          id: "supp-1",
          object: "suppression",
          email: "blocked@test.com",
          reason: "bounced",
          scope: "user",
        },
      ],
      has_more: false,
    });
    expect(mockListSuppressions).toHaveBeenCalledWith({
      userId: "user-1",
      limit: 10,
      after: undefined,
    });
  });

  it("removes a suppression for the authenticated user", async () => {
    mockRemoveSuppression.mockResolvedValue({ id: "supp-1" });

    const { DELETE } = await import("@/app/api/suppressions/[email]/route");
    const res = await DELETE(
      new Request("http://localhost:3015/api/suppressions/blocked%40test.com", {
        method: "DELETE",
        headers: { Authorization: "Bearer re_test" },
      }),
      { params: Promise.resolve({ email: "blocked%40test.com" }) },
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      object: "suppression",
      deleted: true,
    });
    expect(mockRemoveSuppression).toHaveBeenCalledWith({
      userId: "user-1",
      email: "blocked@test.com",
    });
  });
});
