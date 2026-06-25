import { beforeEach, describe, expect, it, vi } from "vitest";

const mockEq = vi.hoisted(() =>
  vi.fn((...args: unknown[]) => ({ op: "eq", args })),
);
const mockContactFindFirst = vi.hoisted(() => vi.fn());
const mockTopicsFindMany = vi.hoisted(() => vi.fn());
const mockBroadcastFindFirst = vi.hoisted(() => vi.fn());
const mockDb = vi.hoisted(() => ({
  query: {
    contacts: { findFirst: mockContactFindFirst },
    topics: { findMany: mockTopicsFindMany },
    broadcasts: { findFirst: mockBroadcastFindFirst },
  },
  update: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db: mockDb }));
vi.mock("@opensend/core", async () => {
  const topicPreferences = await vi.importActual<
    typeof import("../packages/core/src/services/topic-preferences")
  >("../packages/core/src/services/topic-preferences");
  return {
    ...topicPreferences,
    getUnsubscribePageSettings: vi.fn(async () => ({
      logoUrl: null,
      brandColor: "#10b981",
      headline: "Subscription preferences",
      message: "Manage which updates you receive from this sender.",
      footerText: "Powered by OpenSend",
    })),
  };
});
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

  it("uses the OpenSend unsubscribe placeholder and supports the legacy Resend alias", async () => {
    const {
      OPENSEND_UNSUBSCRIBE_URL,
      RESEND_UNSUBSCRIBE_URL,
      hasUnsubscribePlaceholder,
      replaceUnsubscribePlaceholder,
    } = await import("@/lib/unsubscribe");

    expect(OPENSEND_UNSUBSCRIBE_URL).toBe("{{{OPENSEND_UNSUBSCRIBE_URL}}}");
    expect(
      hasUnsubscribePlaceholder(`Leave: ${OPENSEND_UNSUBSCRIBE_URL}`),
    ).toBe(true);
    expect(hasUnsubscribePlaceholder(`Leave: ${RESEND_UNSUBSCRIBE_URL}`)).toBe(
      true,
    );
    expect(
      replaceUnsubscribePlaceholder(
        `${OPENSEND_UNSUBSCRIBE_URL} ${RESEND_UNSUBSCRIBE_URL}`,
        "https://app.opensend.test/unsubscribe/contact",
      ),
    ).toBe(
      "https://app.opensend.test/unsubscribe/contact https://app.opensend.test/unsubscribe/contact",
    );
  });
});

describe("public unsubscribe route", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.UNSUBSCRIBE_SECRET = "test-unsubscribe-secret";
    mockDb.update.mockReset();
    mockContactFindFirst.mockReset();
    mockTopicsFindMany.mockReset();
    mockBroadcastFindFirst.mockReset();
  });

  function mockSignedContact() {
    mockContactFindFirst.mockResolvedValue({
      id: "contact-173",
      email: "contact-173@example.test",
      firstName: null,
      lastName: null,
      unsubscribed: false,
      customProperties: null,
      segments: null,
      topicSubscriptions: [],
      createdAt: new Date(),
      document: null,
      userId: null,
    });
    mockTopicsFindMany.mockResolvedValue([]);
    mockBroadcastFindFirst.mockResolvedValue(undefined);
  }

  function mockSuccessfulUpdate() {
    const returning = vi.fn().mockResolvedValue([{ id: "contact-173" }]);
    const where = vi.fn().mockReturnValue({ returning });
    const set = vi.fn().mockReturnValue({ where });
    mockDb.update.mockReturnValue({ set });
    return { set, where, returning };
  }

  it("GET renders preferences without marking the contact unsubscribed", async () => {
    mockSignedContact();
    const { createUnsubscribeUrl } = await import("@/lib/unsubscribe");
    const { GET } = await import("@/app/unsubscribe/[contactId]/route");
    const contactId = "contact-173";
    const url = createUnsubscribeUrl(contactId, "http://localhost:3015");

    const res = await GET(new Request(url), {
      params: Promise.resolve({ contactId }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    await expect(res.text()).resolves.toContain("Subscription preferences");
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it("GET renders topic preference update and unsubscribe-all actions", async () => {
    mockContactFindFirst.mockResolvedValue({
      id: "contact-173",
      email: "contact-173@example.test",
      firstName: null,
      lastName: null,
      unsubscribed: false,
      customProperties: null,
      segments: null,
      topicSubscriptions: [],
      createdAt: new Date(),
      document: null,
      userId: "user-173",
    });
    mockTopicsFindMany.mockResolvedValue([
      {
        id: "topic-public",
        name: "Product updates",
        description: null,
        defaultSubscription: "opt_in",
        visibility: "public",
      },
      {
        id: "topic-newsletter",
        name: "Newsletter",
        description: "Monthly updates",
        defaultSubscription: "opt_out",
        visibility: "public",
      },
    ]);
    mockBroadcastFindFirst.mockResolvedValue(undefined);
    const { createUnsubscribeUrl } = await import("@/lib/unsubscribe");
    const { GET } = await import("@/app/unsubscribe/[contactId]/route");
    const contactId = "contact-173";
    const url = createUnsubscribeUrl(contactId, "http://localhost:3015");

    const res = await GET(new Request(url), {
      params: Promise.resolve({ contactId }),
    });
    const html = await res.text();

    expect(res.status).toBe(200);
    expect(html).toContain("Product updates");
    expect(html).toContain("Newsletter");
    expect(html).toContain(
      '<a href="https://opensend.namuh.co" target="_blank" rel="noopener noreferrer">Powered by OpenSend</a>',
    );
    expect(html).toContain(
      '<button type="submit" name="action" value="save_preferences">Update preferences</button>',
    );
    expect(html).toContain(
      '<button class="primary" type="submit" name="action" value="unsubscribe_all">Unsubscribe from all</button>',
    );
    expect(html.indexOf('value="unsubscribe_all"')).toBeLessThan(
      html.indexOf('value="save_preferences"'),
    );
  });

  it("POST returns an empty RFC 8058 success response and marks unsubscribed", async () => {
    mockSuccessfulUpdate();
    const { createUnsubscribeUrl } = await import("@/lib/unsubscribe");
    const { POST } = await import("@/app/unsubscribe/[contactId]/route");
    const contactId = "contact-173";
    const url = createUnsubscribeUrl(contactId, "http://localhost:3015");

    const res = await POST(
      new Request(url, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: "List-Unsubscribe=One-Click",
      }),
      {
        params: Promise.resolve({ contactId }),
      },
    );

    expect(res.status).toBe(202);
    expect(await res.text()).toBe("");
    expect(mockDb.update).toHaveBeenCalledOnce();
  });

  it("POST rejects ambiguous browser actions without mutating contact state", async () => {
    const { createUnsubscribeUrl } = await import("@/lib/unsubscribe");
    const { POST } = await import("@/app/unsubscribe/[contactId]/route");
    const contactId = "contact-173";
    const url = createUnsubscribeUrl(contactId, "http://localhost:3015");

    for (const body of [
      "",
      "action=unexpected",
      "List-Unsubscribe=One-Click&action=save_preferences",
    ]) {
      mockDb.update.mockClear();
      const res = await POST(
        new Request(url, {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body,
        }),
        {
          params: Promise.resolve({ contactId }),
        },
      );

      expect(res.status).toBe(400);
      await expect(res.text()).resolves.toContain("Something went wrong");
      expect(mockDb.update).not.toHaveBeenCalled();
    }
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
