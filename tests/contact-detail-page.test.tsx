import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetServerSession = vi.hoisted(() => vi.fn());
const mockGetContact = vi.hoisted(() => vi.fn());
const mockListContactSegments = vi.hoisted(() => vi.fn());
const mockListContactTopics = vi.hoisted(() => vi.fn());
const mockNotFound = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
);
const mockRedirect = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
);

class MockContactServiceError extends Error {
  constructor(
    readonly code: "not_found" | "duplicate_email",
    message: string,
  ) {
    super(message);
    this.name = "ContactServiceError";
  }
}

class MockContactOperationsServiceError extends Error {
  constructor(
    readonly code: "not_found" | "invalid_input",
    message: string,
  ) {
    super(message);
    this.name = "ContactOperationsServiceError";
  }
}

vi.mock("@/lib/api-auth", () => ({
  getServerSession: mockGetServerSession,
}));

vi.mock("@opensend/core", () => ({
  ContactServiceError: MockContactServiceError,
  ContactOperationsServiceError: MockContactOperationsServiceError,
  createContactService: () => ({
    getContact: mockGetContact,
    listContactSegments: mockListContactSegments,
  }),
  createContactOperationsService: () => ({
    listContactTopics: mockListContactTopics,
  }),
}));

vi.mock("next/navigation", () => ({
  notFound: mockNotFound,
  redirect: mockRedirect,
}));

vi.mock("@/components/contact-detail", () => ({
  ContactDetail: (props: {
    contact: { email: string; createdAt: string };
  }) => (
    <div data-testid="contact-detail">
      {props.contact.email}|{props.contact.createdAt}
    </div>
  ),
}));

describe("ContactDetailPage", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue({ user: { id: "user-1" } });
    mockListContactSegments.mockResolvedValue([]);
    mockListContactTopics.mockResolvedValue({ object: "list", data: [] });
  });

  it("renders an owned contact when detail data has serialized timestamps", async () => {
    mockGetContact.mockResolvedValue({
      object: "contact",
      id: "contact-1",
      email: "person@example.com",
      first_name: null,
      last_name: null,
      unsubscribed: false,
      properties: null,
      segments: [],
      topics: [],
      created_at: "2026-06-24T00:00:00.000Z",
    });

    const Page = (await import("@/app/(dashboard)/audience/contacts/[id]/page"))
      .default;
    const element = await Page({
      params: Promise.resolve({ id: "contact-1" }),
    });

    expect(renderToStaticMarkup(element)).toContain("person@example.com");
    expect(mockGetContact).toHaveBeenCalledWith("contact-1", "user-1");
    expect(mockListContactSegments).toHaveBeenCalledWith("contact-1", "user-1");
    expect(mockListContactTopics).toHaveBeenCalledWith({
      idOrEmail: "contact-1",
      userId: "user-1",
    });
    expect(mockNotFound).not.toHaveBeenCalled();
  });

  it("redirects unauthenticated dashboard contact detail access", async () => {
    mockGetServerSession.mockResolvedValueOnce(null);

    const Page = (await import("@/app/(dashboard)/audience/contacts/[id]/page"))
      .default;

    await expect(
      Page({ params: Promise.resolve({ id: "contact-1" }) }),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(mockRedirect).toHaveBeenCalledWith("/auth");
    expect(mockGetContact).not.toHaveBeenCalled();
  });

  it("shows not found only for the contact service not_found case", async () => {
    mockGetContact.mockRejectedValue(
      new MockContactServiceError("not_found", "Contact not found"),
    );

    const Page = (await import("@/app/(dashboard)/audience/contacts/[id]/page"))
      .default;

    await expect(
      Page({ params: Promise.resolve({ id: "missing-contact" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mockNotFound).toHaveBeenCalledOnce();
  });
});
