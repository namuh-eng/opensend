/**
 * Unit tests for unsubscribe page settings validation, service defaults,
 * repo upsert round-trips, and XSS escaping in the public route.
 *
 * DB client is mocked at the internal package path so no real Postgres
 * connection is needed — same pattern as dedicated-ip-pool-repo.test.ts.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Hoisted mock objects ─────────────────────────────────────────────────────
const mockFindFirst = vi.hoisted(() => vi.fn());
const mockInsert = vi.hoisted(() => vi.fn());

// Mock the DB client used by packages/core
vi.mock("../packages/core/src/db/client", () => ({
  db: {
    query: {
      unsubscribePageSettings: { findFirst: mockFindFirst },
    },
    insert: mockInsert,
  },
}));

// Mock the app DB used by the public route
const mockRouteContactFindFirst = vi.hoisted(() => vi.fn());
const mockRouteTopicsFindMany = vi.hoisted(() => vi.fn());
const mockRouteBroadcastFindFirst = vi.hoisted(() => vi.fn());
const mockRouteUpdate = vi.hoisted(() => vi.fn());
const mockRouteDb = vi.hoisted(() => ({
  query: {
    contacts: { findFirst: mockRouteContactFindFirst },
    topics: { findMany: mockRouteTopicsFindMany },
    broadcasts: { findFirst: mockRouteBroadcastFindFirst },
  },
  update: mockRouteUpdate,
}));
vi.mock("@/lib/db", () => ({ db: mockRouteDb }));

// Mock drizzle-orm eq so route tests still work
const mockEq = vi.hoisted(() =>
  vi.fn((...args: unknown[]) => ({ op: "eq", args })),
);
vi.mock("drizzle-orm", async () => {
  const actual = await vi.importActual("drizzle-orm");
  return { ...actual, eq: mockEq };
});

import {
  UnsubscribePageSettingsValidationError,
  getUnsubscribePageSettings,
  updateUnsubscribePageSettings,
} from "@opensend/core";

// ── Defaults ─────────────────────────────────────────────────────────────────
describe("getUnsubscribePageSettings — no row", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindFirst.mockResolvedValue(undefined);
  });

  it("returns system defaults when no row exists for the user", async () => {
    const result = await getUnsubscribePageSettings("user-1");
    expect(result.brandColor).toBe("#10b981");
    expect(result.headline).toBe("Unsubscribed successfully");
    expect(result.logoUrl).toBeNull();
    expect(result.footerText).toBe("Powered by OpenSend");
  });
});

describe("getUnsubscribePageSettings — row exists", () => {
  const ROW = {
    id: "uuid-1",
    userId: "user-1",
    logoUrl: "https://example.com/logo.png",
    brandColor: "#ff0000",
    headline: "You're out!",
    message: "Done.",
    footerText: "My Company",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockFindFirst.mockResolvedValue(ROW);
  });

  it("returns the stored row values", async () => {
    const result = await getUnsubscribePageSettings("user-1");
    expect(result.brandColor).toBe("#ff0000");
    expect(result.headline).toBe("You're out!");
    expect(result.logoUrl).toBe("https://example.com/logo.png");
    expect(result.footerText).toBe("My Company");
  });
});

// ── Upsert round-trip ────────────────────────────────────────────────────────
describe("updateUnsubscribePageSettings — upsert", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes validated values through and returns updated settings", async () => {
    const ROW = {
      id: "uuid-2",
      userId: "user-2",
      logoUrl: "https://cdn.example.com/logo.svg",
      brandColor: "#123456",
      headline: "Bye!",
      message: "You won't hear from us.",
      footerText: "ACME Corp",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const returningMock = vi.fn().mockResolvedValueOnce([ROW]);
    const onConflictMock = vi
      .fn()
      .mockReturnValueOnce({ returning: returningMock });
    const valuesMock = vi
      .fn()
      .mockReturnValueOnce({ onConflictDoUpdate: onConflictMock });
    mockInsert.mockReturnValueOnce({ values: valuesMock });

    const result = await updateUnsubscribePageSettings("user-2", {
      logoUrl: "https://cdn.example.com/logo.svg",
      brandColor: "#123456",
      headline: "Bye!",
      message: "You won't hear from us.",
      footerText: "ACME Corp",
    });

    expect(result.brandColor).toBe("#123456");
    expect(result.headline).toBe("Bye!");
    expect(result.logoUrl).toBe("https://cdn.example.com/logo.svg");
    expect(mockInsert).toHaveBeenCalledOnce();
  });
});

// ── Validation ───────────────────────────────────────────────────────────────
describe("updateUnsubscribePageSettings — validation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects an invalid hex color", async () => {
    await expect(
      updateUnsubscribePageSettings("user-3", { brandColor: "not-a-color" }),
    ).rejects.toBeInstanceOf(UnsubscribePageSettingsValidationError);
  });

  it("rejects a hex color without leading #", async () => {
    await expect(
      updateUnsubscribePageSettings("user-3", { brandColor: "10b981" }),
    ).rejects.toBeInstanceOf(UnsubscribePageSettingsValidationError);
  });

  it("accepts a valid 6-digit hex color", async () => {
    const ROW = {
      id: "uuid-3",
      userId: "user-3",
      logoUrl: null,
      brandColor: "#aabbcc",
      headline: "Unsubscribed successfully",
      message: "Done.",
      footerText: "OpenSend",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const returningMock = vi.fn().mockResolvedValueOnce([ROW]);
    const onConflictMock = vi
      .fn()
      .mockReturnValueOnce({ returning: returningMock });
    const valuesMock = vi
      .fn()
      .mockReturnValueOnce({ onConflictDoUpdate: onConflictMock });
    mockInsert.mockReturnValueOnce({ values: valuesMock });

    const result = await updateUnsubscribePageSettings("user-3", {
      brandColor: "#aabbcc",
    });
    expect(result.brandColor).toBe("#aabbcc");
  });

  it("accepts a valid 8-digit hex color", async () => {
    const ROW = {
      id: "uuid-4",
      userId: "user-4",
      logoUrl: null,
      brandColor: "#aabbccdd",
      headline: "Unsubscribed successfully",
      message: "Done.",
      footerText: "OpenSend",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const returningMock = vi.fn().mockResolvedValueOnce([ROW]);
    const onConflictMock = vi
      .fn()
      .mockReturnValueOnce({ returning: returningMock });
    const valuesMock = vi
      .fn()
      .mockReturnValueOnce({ onConflictDoUpdate: onConflictMock });
    mockInsert.mockReturnValueOnce({ values: valuesMock });

    const result = await updateUnsubscribePageSettings("user-4", {
      brandColor: "#aabbccdd",
    });
    expect(result.brandColor).toBe("#aabbccdd");
  });

  it("rejects a non-http logo URL", async () => {
    await expect(
      updateUnsubscribePageSettings("user-3", {
        logoUrl: "ftp://example.com/logo.png",
      }),
    ).rejects.toBeInstanceOf(UnsubscribePageSettingsValidationError);
  });

  it("rejects a syntactically invalid logo URL", async () => {
    await expect(
      updateUnsubscribePageSettings("user-3", { logoUrl: "not a url" }),
    ).rejects.toBeInstanceOf(UnsubscribePageSettingsValidationError);
  });

  it("accepts a valid https logo URL", async () => {
    const ROW = {
      id: "uuid-5",
      userId: "user-5",
      logoUrl: "https://cdn.example.com/logo.png",
      brandColor: "#10b981",
      headline: "Unsubscribed successfully",
      message: "Done.",
      footerText: "OpenSend",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const returningMock = vi.fn().mockResolvedValueOnce([ROW]);
    const onConflictMock = vi
      .fn()
      .mockReturnValueOnce({ returning: returningMock });
    const valuesMock = vi
      .fn()
      .mockReturnValueOnce({ onConflictDoUpdate: onConflictMock });
    mockInsert.mockReturnValueOnce({ values: valuesMock });

    const result = await updateUnsubscribePageSettings("user-5", {
      logoUrl: "https://cdn.example.com/logo.png",
    });
    expect(result.logoUrl).toBe("https://cdn.example.com/logo.png");
  });

  it("rejects over-length headline", async () => {
    await expect(
      updateUnsubscribePageSettings("user-3", {
        headline: "a".repeat(201),
      }),
    ).rejects.toBeInstanceOf(UnsubscribePageSettingsValidationError);
  });

  it("rejects over-length message", async () => {
    await expect(
      updateUnsubscribePageSettings("user-3", {
        message: "a".repeat(1001),
      }),
    ).rejects.toBeInstanceOf(UnsubscribePageSettingsValidationError);
  });

  it("rejects over-length footerText", async () => {
    await expect(
      updateUnsubscribePageSettings("user-3", {
        footerText: "a".repeat(201),
      }),
    ).rejects.toBeInstanceOf(UnsubscribePageSettingsValidationError);
  });
});

// ── XSS escaping in the public route ────────────────────────────────────────
describe("public unsubscribe route — XSS escaping", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.UNSUBSCRIBE_SECRET = "test-unsubscribe-secret";
    mockRouteUpdate.mockReset();
    mockRouteContactFindFirst.mockReset();
    mockRouteTopicsFindMany.mockReset();
    mockRouteBroadcastFindFirst.mockReset();
    mockFindFirst.mockReset();
  });

  function mockSignedContact(userId = "user-xss") {
    mockRouteContactFindFirst.mockResolvedValue({
      id: "contact-xss",
      email: "xss@example.test",
      firstName: null,
      lastName: null,
      unsubscribed: false,
      customProperties: null,
      segments: null,
      topicSubscriptions: [],
      createdAt: new Date(),
      document: null,
      userId,
    });
    mockRouteTopicsFindMany.mockResolvedValue([]);
    mockRouteBroadcastFindFirst.mockResolvedValue(undefined);
  }

  it("HTML-escapes a headline containing a <script> tag", async () => {
    mockSignedContact("user-xss");

    const maliciousSettings = {
      id: "uuid-xss",
      userId: "user-xss",
      logoUrl: null,
      brandColor: "#10b981",
      headline: '<script>alert("xss")</script>',
      message: "Clean message.",
      footerText: "Safe footer",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockFindFirst.mockResolvedValue(maliciousSettings);

    const { createUnsubscribeUrl } = await import("@/lib/unsubscribe");
    const { GET } = await import("@/app/unsubscribe/[contactId]/route");

    const contactId = "contact-xss";
    const url = createUnsubscribeUrl(contactId, "http://localhost:3015");

    const res = await GET(new Request(url), {
      params: Promise.resolve({ contactId }),
    });
    const html = await res.text();

    // The raw script tag must NOT appear in the output
    expect(html).not.toContain('<script>alert("xss")</script>');
    // The escaped version must appear instead
    expect(html).toContain("&lt;script&gt;");
  });

  it("HTML-escapes a message containing double quotes", async () => {
    mockSignedContact("user-xss2");

    const maliciousSettings = {
      id: "uuid-xss2",
      userId: "user-xss2",
      logoUrl: null,
      brandColor: "#10b981",
      headline: "Unsubscribed",
      message: 'Message with "quotes" and & ampersand',
      footerText: "Footer",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockFindFirst.mockResolvedValue(maliciousSettings);

    const { createUnsubscribeUrl } = await import("@/lib/unsubscribe");
    const { GET } = await import("@/app/unsubscribe/[contactId]/route");

    const contactId = "contact-xss2";
    const url = createUnsubscribeUrl(contactId, "http://localhost:3015");

    const res = await GET(new Request(url), {
      params: Promise.resolve({ contactId }),
    });
    const html = await res.text();

    expect(html).not.toContain('"quotes"');
    expect(html).toContain("&quot;quotes&quot;");
    expect(html).toContain("&amp; ampersand");
  });

  it("falls back to default brand color when an invalid color is stored", async () => {
    mockSignedContact("user-xss3");

    const badColorSettings = {
      id: "uuid-xss3",
      userId: "user-xss3",
      logoUrl: null,
      brandColor: "javascript:alert(1)",
      headline: "Unsubscribed",
      message: "Done.",
      footerText: "Footer",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockFindFirst.mockResolvedValue(badColorSettings);

    const { createUnsubscribeUrl } = await import("@/lib/unsubscribe");
    const { GET } = await import("@/app/unsubscribe/[contactId]/route");

    const contactId = "contact-xss3";
    const url = createUnsubscribeUrl(contactId, "http://localhost:3015");

    const res = await GET(new Request(url), {
      params: Promise.resolve({ contactId }),
    });
    const html = await res.text();

    // The bad value must not appear
    expect(html).not.toContain("javascript:alert");
    // The default color must be used instead
    expect(html).toContain("#10b981");
  });

  it("renders no logo when logo URL uses a non-http scheme", async () => {
    mockSignedContact("user-xss4");

    const badLogoSettings = {
      id: "uuid-xss4",
      userId: "user-xss4",
      logoUrl: 'javascript:alert("xss")',
      brandColor: "#10b981",
      headline: "Unsubscribed",
      message: "Done.",
      footerText: "Footer",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockFindFirst.mockResolvedValue(badLogoSettings);

    const { createUnsubscribeUrl } = await import("@/lib/unsubscribe");
    const { GET } = await import("@/app/unsubscribe/[contactId]/route");

    const contactId = "contact-xss4";
    const url = createUnsubscribeUrl(contactId, "http://localhost:3015");

    const res = await GET(new Request(url), {
      params: Promise.resolve({ contactId }),
    });
    const html = await res.text();

    // No img tag should be rendered for an invalid URL
    expect(html).not.toContain("<img");
    expect(html).not.toContain("javascript:alert");
  });
});
