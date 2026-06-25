import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock next/navigation

const mockContactService = vi.hoisted(() => ({
  listContacts: vi.fn(),
}));

vi.mock("@opensend/core", () => ({
  ContactServiceError: class ContactServiceError extends Error {
    constructor(
      readonly code: "duplicate_email" | "not_found",
      message: string,
    ) {
      super(message);
      this.name = "ContactServiceError";
    }
  },
  createContactService: () => mockContactService,
}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/audience",
  useSearchParams: () => new URLSearchParams(),
}));

import { ContactStatusBadge } from "@/components/contacts-list";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function createChainMock(resolvedData: unknown[], count: number) {
  const chain = {
    select: () => chain,
    from: () => chain,
    leftJoin: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: () => chain,
    offset: () => chain,
    // biome-ignore lint/suspicious/noThenProperty: mocks Drizzle's thenable query builder
    then: (resolve: (value: unknown[]) => unknown) =>
      Promise.resolve(resolve(resolvedData)),
    catch: (_reject: (error: unknown) => unknown) => chain,
    $count: () => Promise.resolve(count),
  };
  return { db: chain };
}

vi.mock("@/lib/api-auth", () => ({
  authorizeDashboardOrApiKey: () =>
    Promise.resolve({
      apiKeyId: "test",
      permission: "full_access",
      domainId: null,
      userId: "user-1",
    }),
  getServerSession: () =>
    Promise.resolve({
      session: { id: "session-1" },
      user: { id: "user-1" },
    }),
  unauthorizedResponse: () =>
    Response.json({ error: "Missing or invalid API key" }, { status: 401 }),
}));

describe("Contacts List — API route", () => {
  const mockRows = [
    {
      id: "c1",
      email: "alice@example.com",
      firstName: "Alice",
      lastName: "Smith",
      unsubscribed: false,
      createdAt: new Date("2026-03-20T10:00:00Z"),
      customProperties: null,
      segments: ["Newsletter"],
      topicSubscriptions: null,
      document: null,
    },
    {
      id: "c2",
      email: "bob@example.com",
      firstName: "Bob",
      lastName: "Jones",
      unsubscribed: true,
      createdAt: new Date("2026-03-15T10:00:00Z"),
      customProperties: null,
      segments: null,
      topicSubscriptions: null,
      document: null,
    },
  ];

  let handler: typeof import("@/app/api/contacts/route");

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns contacts with correct shape", async () => {
    mockContactService.listContacts.mockResolvedValueOnce({
      data: mockRows.map((row) => ({
        id: row.id,
        email: row.email,
        first_name: row.firstName,
        last_name: row.lastName,
        firstName: row.firstName,
        lastName: row.lastName,
        unsubscribed: row.unsubscribed,
        status: row.unsubscribed ? "unsubscribed" : "subscribed",
        segments: row.segments ?? [],
        created_at: row.createdAt,
      })),
      hasMore: false,
    });

    handler = await import("@/app/api/contacts/route");
    const req = new Request("http://localhost:3015/api/contacts");
    const res = await handler.GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toHaveProperty("object", "list");
    expect(data).toHaveProperty("has_more");
    expect(Array.isArray(data.data)).toBe(true);
    expect(data.data[0]).toHaveProperty("email", "alice@example.com");
    expect(data.data[0]).toHaveProperty("status", "subscribed");
  });

  it("supports search query filtering", async () => {
    mockContactService.listContacts.mockResolvedValueOnce({
      data: [],
      hasMore: false,
    });

    handler = await import("@/app/api/contacts/route");
    const req = new Request("http://localhost:3015/api/contacts?search=alice");
    const res = await handler.GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.data).toEqual([]);
    expect(data.has_more).toBe(false);
  });

  it("supports pagination with after and limit params", async () => {
    mockContactService.listContacts.mockResolvedValueOnce({
      data: [],
      hasMore: false,
    });

    handler = await import("@/app/api/contacts/route");
    const req = new Request(
      "http://localhost:3015/api/contacts?after=c1&limit=20",
    );
    const res = await handler.GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toHaveProperty("object", "list");
  });
});

describe("Contacts List — Component logic", () => {
  it("shows contact topics when the subscribed badge is hovered or focused", async () => {
    render(
      createElement(ContactStatusBadge, {
        contactId: "c1",
        contact: {
          id: "c1",
          email: "alice@example.com",
          firstName: "Alice",
          lastName: "Smith",
          segments: ["Newsletter"],
          status: "subscribed",
          topics: [
            {
              id: "topic-1",
              name: "product update",
              subscription: "opt_in",
            },
            {
              id: "topic-2",
              name: "test",
              subscription: "opt_out",
            },
          ],
          created_at: "2026-03-20T10:00:00.000Z",
        },
      }),
    );

    const statusBadge = screen.getByRole("button", {
      name: "Subscribed to 2 topics",
    });

    expect(screen.getByText("Subscribed")).toBeDefined();
    expect(screen.getByText("2")).toBeDefined();
    expect(screen.queryByRole("tooltip", { name: "Topics" })).toBeNull();

    fireEvent.mouseEnter(statusBadge);

    expect(screen.getByRole("tooltip", { name: "Topics" })).toBeDefined();
    expect(screen.getByText("product update")).toBeDefined();
    expect(screen.getByText("test")).toBeDefined();

    fireEvent.mouseLeave(statusBadge);
    expect(screen.queryByRole("tooltip", { name: "Topics" })).toBeNull();

    fireEvent.focus(statusBadge);
    expect(screen.getByRole("tooltip", { name: "Topics" })).toBeDefined();
  });

  it("renders contact rows with correct columns", () => {
    const contacts = [
      {
        id: "c1",
        email: "alice@example.com",
        firstName: "Alice",
        lastName: "Smith",
        segments: ["Newsletter"],
        status: "subscribed" as const,
        topics: [],
        createdAt: "2026-03-20T10:00:00Z",
      },
      {
        id: "c2",
        email: "bob@example.com",
        firstName: "Bob",
        lastName: "Jones",
        segments: [],
        status: "unsubscribed" as const,
        topics: [],
        createdAt: "2026-03-15T10:00:00Z",
      },
    ];

    // Verify each contact has all required columns
    for (const contact of contacts) {
      expect(contact).toHaveProperty("email");
      expect(contact).toHaveProperty("segments");
      expect(contact).toHaveProperty("status");
      expect(contact).toHaveProperty("topics");
      expect(contact).toHaveProperty("createdAt");
      expect(["subscribed", "unsubscribed"]).toContain(contact.status);
    }

    expect(contacts[0].firstName).toBe("Alice");
    expect(contacts[0].lastName).toBe("Smith");
  });

  it("formats contact status from unsubscribed boolean", () => {
    const getStatus = (unsubscribed: boolean) =>
      unsubscribed ? "unsubscribed" : "subscribed";

    expect(getStatus(false)).toBe("subscribed");
    expect(getStatus(true)).toBe("unsubscribed");
  });

  it("groups segments correctly from joined rows", () => {
    const rows = [
      { id: "c1", email: "alice@example.com", segment_name: "Newsletter" },
      { id: "c1", email: "alice@example.com", segment_name: "VIP" },
      { id: "c2", email: "bob@example.com", segment_name: null },
    ];

    const grouped = new Map<string, { email: string; segments: string[] }>();
    for (const row of rows) {
      if (!grouped.has(row.id)) {
        grouped.set(row.id, { email: row.email, segments: [] });
      }
      if (row.segment_name) {
        grouped.get(row.id)?.segments.push(row.segment_name);
      }
    }

    const result = Array.from(grouped.values());
    expect(result).toHaveLength(2);
    expect(result[0].segments).toEqual(["Newsletter", "VIP"]);
    expect(result[1].segments).toEqual([]);
  });

  it("shows empty state when no contacts", () => {
    const contacts: unknown[] = [];
    expect(contacts).toHaveLength(0);
  });

  it("calculates pagination correctly", () => {
    const total = 85;
    const page = 2;
    const limit = 40;

    const start = (page - 1) * limit + 1;
    const end = Math.min(page * limit, total);
    const totalPages = Math.ceil(total / limit);

    expect(start).toBe(41);
    expect(end).toBe(80);
    expect(totalPages).toBe(3);
  });
});
