import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: () => "/audience/topics",
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

// Mock next/link
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: { children: React.ReactNode; href: string }) => {
    return React.createElement("a", { href, ...props }, children);
  },
}));

// Import component once — it uses mocked fetch
import { TopicsList } from "@/components/topics-list";

function renderTopics() {
  return render(React.createElement(TopicsList));
}

describe("TopicsList", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders empty state when no topics", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [], total: 0, page: 1, limit: 20 }),
    });

    renderTopics();

    await waitFor(() => {
      expect(screen.getByText("No topics yet")).toBeTruthy();
    });

    // Should have create topic buttons (one in filter bar, one in empty state)
    const createButtons = screen.getAllByText("Create topic");
    expect(createButtons.length).toBe(2);
    // The unsubscribe page editor links to the customization page.
    const customizeControls = screen.getAllByText("Customize page");
    expect(customizeControls.length).toBeGreaterThanOrEqual(1);
    for (const control of customizeControls) {
      expect(control.closest("a")?.getAttribute("href")).toBe(
        "/audience/topics/unsubscribe-page/edit",
      );
    }
  });

  it("renders topics list with data", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          {
            id: "t1",
            name: "Marketing Updates",
            description: "Monthly marketing newsletter",
            default_subscription: "opt_out",
            visibility: "public",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          {
            id: "t2",
            name: "Product News",
            description: null,
            default_subscription: "opt_in",
            visibility: "private",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ],
        total: 2,
        page: 1,
        limit: 20,
      }),
    });

    renderTopics();

    await waitFor(() => {
      // Topic names appear in table AND unsubscribe preview
      const marketingEls = screen.getAllByText("Marketing Updates");
      expect(marketingEls.length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.getAllByText("Product News")).toHaveLength(1);
    expect(
      screen.getAllByText("Marketing Updates").length,
    ).toBeGreaterThanOrEqual(2);
    // Table shows formatted default/visibility values
    const optOutEls = screen.getAllByText("Opt-out");
    expect(optOutEls.length).toBeGreaterThanOrEqual(1);
    const optInEls = screen.getAllByText("Opt-in");
    expect(optInEls.length).toBeGreaterThanOrEqual(1);
    // Only public topics show in preview, but column shows both
    expect(screen.getAllByText("Public").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Private").length).toBeGreaterThanOrEqual(1);
  });

  it("has search input and default filter", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [], total: 0, page: 1, limit: 20 }),
    });

    renderTopics();

    await waitFor(() => {
      expect(screen.getByText("No topics yet")).toBeTruthy();
    });

    const searchInputs = screen.getAllByPlaceholderText("Search...");
    expect(searchInputs.length).toBeGreaterThanOrEqual(1);

    // Default filter dropdown — check by option text
    expect(screen.getByText("Any Default")).toBeTruthy();
  });

  it("create topic modal shows all 4 fields", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [], total: 0, page: 1, limit: 20 }),
    });

    renderTopics();

    await waitFor(() => {
      expect(screen.getByText("No topics yet")).toBeTruthy();
    });

    // Click create topic button in the filter bar (first one)
    const createButtons = screen.getAllByText("Create topic");
    fireEvent.click(createButtons[0]);

    // Modal should appear with all 4 fields
    await waitFor(() => {
      expect(screen.getByText("Create a new topic")).toBeTruthy();
    });

    // Name field
    expect(screen.getByPlaceholderText("Public display name")).toBeTruthy();
    // Description field
    expect(
      screen.getByPlaceholderText("Optional public description"),
    ).toBeTruthy();
    // Defaults to field
    expect(screen.getByLabelText("Defaults to")).toBeTruthy();
    // Visibility field
    expect(screen.getByLabelText("Visibility")).toBeTruthy();
  });

  it("name field has maxlength of 50", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [], total: 0, page: 1, limit: 20 }),
    });

    renderTopics();

    await waitFor(() => {
      expect(screen.getByText("No topics yet")).toBeTruthy();
    });

    const createButtons = screen.getAllByText("Create topic");
    fireEvent.click(createButtons[0]);

    await waitFor(() => {
      const nameInput = screen.getByPlaceholderText("Public display name");
      expect(nameInput.getAttribute("maxlength")).toBe("50");
    });
  });

  it("submits create topic form", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [], total: 0, page: 1, limit: 20 }),
    });

    renderTopics();

    await waitFor(() => {
      expect(screen.getByText("No topics yet")).toBeTruthy();
    });

    const createButtons = screen.getAllByText("Create topic");
    fireEvent.click(createButtons[0]);

    await waitFor(() => {
      expect(screen.getByText("Create a new topic")).toBeTruthy();
    });

    fireEvent.change(screen.getByPlaceholderText("Public display name"), {
      target: { value: "Marketing Updates" },
    });
    fireEvent.change(
      screen.getByPlaceholderText("Optional public description"),
      { target: { value: "Monthly marketing newsletter" } },
    );

    // Mock the POST response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "t1",
        name: "Marketing Updates",
        description: "Monthly marketing newsletter",
        defaultSubscription: "opt_out",
        visibility: "public",
      }),
    });
    // Mock the refetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          {
            id: "t1",
            name: "Marketing Updates",
            description: "Monthly marketing newsletter",
            default_subscription: "opt_out",
            visibility: "public",
            created_at: new Date().toISOString(),
          },
        ],
        total: 1,
        page: 1,
        limit: 20,
      }),
    });

    fireEvent.click(screen.getByText("Add"));

    await waitFor(() => {
      const postCall = mockFetch.mock.calls.find(
        (c: unknown[]) =>
          typeof c[0] === "string" &&
          c[0].includes("/api/topics") &&
          (c[1] as { method?: string })?.method === "POST",
      );
      expect(postCall).toBeTruthy();
      const opts = (postCall as unknown[])[1] as { body: string };
      const body = JSON.parse(opts.body);
      expect(body.name).toBe("Marketing Updates");
      expect(body.description).toBe("Monthly marketing newsletter");
    });
  });

  it("links the unsubscribe page editor CTA to the editor", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [], total: 0, page: 1, limit: 20 }),
    });

    renderTopics();

    await waitFor(() => {
      expect(screen.getByText("No topics yet")).toBeTruthy();
    });

    const control = screen.getByText("Edit Unsubscribe Page");
    const link = control.closest("a");
    expect(link).toBeTruthy();
    expect(link?.getAttribute("href")).toBe(
      "/audience/topics/unsubscribe-page/edit",
    );
    expect(control.closest("button")).toBeNull();
  });

  it("shows unsubscribe page preview section", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [], total: 0, page: 1, limit: 20 }),
    });

    renderTopics();

    await waitFor(() => {
      expect(screen.getByText("No topics yet")).toBeTruthy();
    });

    expect(screen.getByText("Unsubscribe Page Preview")).toBeTruthy();
  });
});

describe("Topics API route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.doMock("@/lib/api-auth", () => ({
      authorizeDashboardOrApiKey: () =>
        Promise.resolve({
          apiKeyId: "test",
          permission: "full_access",
          domain: null,
          userId: "user-1",
        }),
      unauthorizedResponse: () =>
        Response.json({ error: "Missing or invalid API key" }, { status: 401 }),
      getServerSession: () => Promise.resolve({ user: { id: "user-1" } }),
    }));
    vi.doMock("@opensend/core", () => {
      class AudienceMetadataServiceError extends Error {
        constructor(
          readonly code: string,
          message: string,
          readonly status: number,
        ) {
          super(message);
          this.name = "AudienceMetadataServiceError";
        }
      }

      return {
        AudienceMetadataServiceError,
        createAudienceMetadataService: () => ({
          async listTopics() {
            return { object: "list", data: [], has_more: false, total: 0 };
          },
          async createTopic(input: { body: Record<string, unknown> }) {
            const name =
              typeof input.body.name === "string" ? input.body.name.trim() : "";
            if (!name) {
              throw new AudienceMetadataServiceError(
                "invalid_input",
                "Name is required",
                400,
              );
            }
            return {
              object: "topic",
              id: "t1",
              name,
              description:
                typeof input.body.description === "string"
                  ? input.body.description.trim()
                  : null,
              defaultSubscription:
                input.body.defaultSubscription === "opt_in"
                  ? "opt_in"
                  : "opt_out",
              visibility:
                input.body.visibility === "private" ? "private" : "public",
              createdAt: new Date("2026-05-10T00:00:00.000Z"),
            };
          },
        }),
      };
    });
  });

  it("GET /api/topics returns paginated list", async () => {
    vi.doMock("@/lib/db", () => {
      const chain = {
        from: () => chain,
        where: () => chain,
        orderBy: () => chain,
        limit: () => chain,
        // biome-ignore lint/suspicious/noThenProperty: mocks Drizzle's thenable query builder
        then: (resolve: (rows: unknown[]) => unknown) => resolve([]),
        catch: (reject: (err: Error) => unknown) =>
          reject(new Error("Mock error")),
      };
      return {
        db: {
          select: () => chain,
          $count: async () => 0,
        },
      };
    });

    const { GET } = await import("@/app/api/topics/route");
    const url = new URL("http://localhost:3015/api/topics?page=1&limit=10");
    const request = {
      nextUrl: url,
      headers: new Headers(),
    } as unknown as Parameters<typeof GET>[0];
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty("data");
    expect(data).toHaveProperty("has_more");
    expect(Array.isArray(data.data)).toBe(true);
  });

  it("POST /api/topics creates a topic", async () => {
    const mockTopic = {
      id: "t1",
      name: "Test Topic",
      description: "A test topic",
      defaultSubscription: "opt_in",
      visibility: "public",
      createdAt: new Date().toISOString(),
    };

    vi.doMock("@/lib/db", () => {
      const insertChain = {
        values: () => insertChain,
        returning: () => Promise.resolve([mockTopic]),
      };
      return {
        db: { insert: () => insertChain },
      };
    });

    const { POST } = await import("@/app/api/topics/route");
    const request = {
      json: async () => ({
        name: "Test Topic",
        description: "A test topic",
        defaultSubscription: "opt_in",
        visibility: "public",
      }),
      headers: new Headers(),
    } as unknown as Parameters<typeof POST>[0];
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.name).toBe("Test Topic");
    expect(data.description).toBe("A test topic");
    expect(data.defaultSubscription).toBe("opt_in");
    expect(data.visibility).toBe("public");
  });

  it("POST /api/topics rejects empty name", async () => {
    vi.doMock("@/lib/db", () => ({ db: {} }));

    const { POST } = await import("@/app/api/topics/route");
    const request = {
      json: async () => ({ name: "" }),
      headers: new Headers(),
    } as unknown as Parameters<typeof POST>[0];
    const response = await POST(request);

    expect(response.status).toBe(400);
  });
});
