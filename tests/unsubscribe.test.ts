import { beforeEach, describe, expect, it, vi } from "vitest";

const mockEq = vi.hoisted(() =>
  vi.fn((...args: unknown[]) => ({ op: "eq", args })),
);
const mockDb = vi.hoisted(() => ({
  update: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db: mockDb }));
vi.mock("drizzle-orm", async () => {
  const actual = await vi.importActual("drizzle-orm");
  return { ...actual, eq: mockEq };
});

describe("unsubscribe URL helpers", () => {
  beforeEach(() => {
    process.env.UNSUBSCRIBE_SECRET = "test-unsubscribe-secret";
  });

  it("builds stable one-click headers with a signed hosted URL", async () => {
    const {
      buildOneClickUnsubscribeHeaders,
      createUnsubscribeUrl,
      verifyUnsubscribeToken,
    } = await import("@/lib/unsubscribe");

    const url = createUnsubscribeUrl(
      "00000000-0000-4000-8000-000000000173",
      "https://app.opensend.test/",
    );

    expect(url).toMatch(
      /^https:\/\/app\.opensend\.test\/unsubscribe\/00000000-0000-4000-8000-000000000173\?token=/,
    );
    const token = new URL(url).searchParams.get("token");
    expect(
      verifyUnsubscribeToken("00000000-0000-4000-8000-000000000173", token),
    ).toBe(true);
    expect(buildOneClickUnsubscribeHeaders(url)).toEqual({
      "List-Unsubscribe": `<${url}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    });
  });
});

describe("public unsubscribe route", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.UNSUBSCRIBE_SECRET = "test-unsubscribe-secret";
    mockDb.update.mockReset();
  });

  function mockSuccessfulUpdate() {
    const returning = vi.fn().mockResolvedValue([{ id: "contact-173" }]);
    const where = vi.fn().mockReturnValue({ returning });
    const set = vi.fn().mockReturnValue({ where });
    mockDb.update.mockReturnValue({ set });
    return { set, where, returning };
  }

  it("GET renders success and marks the contact unsubscribed without API auth", async () => {
    const chain = mockSuccessfulUpdate();
    const { createUnsubscribeUrl } = await import("@/lib/unsubscribe");
    const { GET } = await import("@/app/unsubscribe/[contactId]/route");
    const contactId = "contact-173";
    const url = createUnsubscribeUrl(contactId, "http://localhost:3015");

    const res = await GET(new Request(url), {
      params: Promise.resolve({ contactId }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    await expect(res.text()).resolves.toContain("Unsubscribed successfully");
    expect(chain.set).toHaveBeenCalledWith({ unsubscribed: true });
  });

  it("POST returns an empty RFC 8058 success response and marks unsubscribed", async () => {
    mockSuccessfulUpdate();
    const { createUnsubscribeUrl } = await import("@/lib/unsubscribe");
    const { POST } = await import("@/app/unsubscribe/[contactId]/route");
    const contactId = "contact-173";
    const url = createUnsubscribeUrl(contactId, "http://localhost:3015");

    const res = await POST(new Request(url, { method: "POST" }), {
      params: Promise.resolve({ contactId }),
    });

    expect(res.status).toBe(202);
    expect(await res.text()).toBe("");
    expect(mockDb.update).toHaveBeenCalledOnce();
  });

  it("does not update contacts when the token is invalid", async () => {
    const { GET } = await import("@/app/unsubscribe/[contactId]/route");

    const res = await GET(
      new Request("http://localhost:3015/unsubscribe/contact-173?token=bad"),
      { params: Promise.resolve({ contactId: "contact-173" }) },
    );

    expect(res.status).toBe(404);
    await expect(res.text()).resolves.toContain("Something went wrong");
    expect(mockDb.update).not.toHaveBeenCalled();
  });
});
