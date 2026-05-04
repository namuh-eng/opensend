import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockRouter = {
  push: vi.fn(),
  refresh: vi.fn(),
  replace: vi.fn(),
};

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
  usePathname: () => "/broadcasts",
  useSearchParams: () => ({
    get: () => null,
  }),
}));

// Mock next/link
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    [key: string]: unknown;
  }) => {
    const React = require("react");
    return React.createElement("a", { href, ...props }, children);
  },
}));

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import React from "react";

type BroadcastsListModule = typeof import("@/components/broadcasts-list");
let BroadcastsList: BroadcastsListModule["BroadcastsList"];

const mockBroadcasts = [
  {
    id: "bc-1",
    name: "Welcome Email",
    status: "sent",
    createdAt: new Date().toISOString(),
  },
  {
    id: "bc-2",
    name: "Product Launch",
    status: "draft",
    createdAt: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: "bc-3",
    name: "Weekly Digest",
    status: "scheduled",
    createdAt: new Date(Date.now() - 172800000).toISOString(),
  },
];

const mockSegments = [
  { id: "seg-1", name: "VIP Customers" },
  { id: "seg-2", name: "Newsletter" },
];

function mockFetchSuccess(
  broadcasts: unknown[] = mockBroadcasts,
  total?: number,
) {
  global.fetch = vi.fn().mockImplementation((url: string) => {
    if (url.includes("/api/segments")) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({ data: mockSegments, total: mockSegments.length }),
      });
    }
    return Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve({
          data: broadcasts,
          total: total ?? broadcasts.length,
        }),
    });
  });
}

describe("BroadcastsList", () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    const mod = await import("@/components/broadcasts-list");
    BroadcastsList = mod.BroadcastsList;
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders broadcast rows with correct columns", async () => {
    mockFetchSuccess();
    render(React.createElement(BroadcastsList));

    await waitFor(() => {
      expect(screen.getByText("Welcome Email")).toBeDefined();
    });

    expect(screen.getByText("Product Launch")).toBeDefined();
    expect(screen.getByText("Weekly Digest")).toBeDefined();

    // Check status column
    expect(screen.getByText("Sent")).toBeDefined();
    expect(screen.getByText("Draft")).toBeDefined();
    expect(screen.getByText("Scheduled")).toBeDefined();
  });

  it("renders column headers: Name, Status, Created", async () => {
    mockFetchSuccess();
    render(React.createElement(BroadcastsList));

    await waitFor(() => {
      expect(screen.getByText("Name")).toBeDefined();
    });
    expect(screen.getByText("Status")).toBeDefined();
    expect(screen.getByText("Created")).toBeDefined();
  });

  it("status filter shows 5 broadcast statuses plus All Statuses", async () => {
    mockFetchSuccess();
    render(React.createElement(BroadcastsList));

    await waitFor(() => {
      expect(screen.getByText("All Statuses")).toBeDefined();
    });

    // Click dropdown to open
    fireEvent.click(screen.getByText("All Statuses"));

    await waitFor(() => {
      const menuItems = screen.getAllByRole("menuitem");
      const menuTexts = menuItems.map((item) => item.textContent);
      expect(menuTexts).toContain("All Statuses");
      expect(menuTexts).toContain("Draft");
      expect(menuTexts).toContain("Scheduled");
      expect(menuTexts).toContain("Queued");
      expect(menuTexts).toContain("Sent");
      expect(menuTexts).toContain("Failed");
    });
  });

  it("shows empty state when no broadcasts", async () => {
    mockFetchSuccess([], 0);
    render(React.createElement(BroadcastsList));

    await waitFor(() => {
      expect(screen.getByText("No broadcasts")).toBeDefined();
    });
  });

  it("has a Create email button", async () => {
    mockFetchSuccess();
    render(React.createElement(BroadcastsList));

    await waitFor(() => {
      expect(screen.getByText("Create email")).toBeDefined();
    });
  });

  it("broadcast name links to /broadcasts/:id/editor", async () => {
    mockFetchSuccess();
    render(React.createElement(BroadcastsList));

    await waitFor(() => {
      expect(screen.getByText("Welcome Email")).toBeDefined();
    });

    const link = screen.getByText("Welcome Email").closest("a");
    expect(link?.getAttribute("href")).toBe("/broadcasts/bc-1/editor");
  });

  it("search input has Search... placeholder", async () => {
    mockFetchSuccess();
    render(React.createElement(BroadcastsList));

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Search...")).toBeDefined();
    });
  });

  it("has checkbox column for row selection", async () => {
    mockFetchSuccess();
    render(React.createElement(BroadcastsList));

    await waitFor(() => {
      expect(screen.getByText("Welcome Email")).toBeDefined();
    });

    // Select all checkbox + one per row = 4 checkboxes
    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes.length).toBe(4); // 1 header + 3 rows
  });

  it("row actions dropdown shows Edit, Duplicate, Clone as template, Remove", async () => {
    mockFetchSuccess();
    render(React.createElement(BroadcastsList));

    await waitFor(() => {
      expect(screen.getByText("Welcome Email")).toBeDefined();
    });

    const actionButtons = screen.getAllByLabelText("More actions");
    expect(actionButtons.length).toBe(3);

    // Click first action button
    fireEvent.click(actionButtons[0]);

    await waitFor(() => {
      expect(screen.getByText("Edit")).toBeDefined();
      expect(screen.getByText("Duplicate")).toBeDefined();
      expect(screen.getByText("Clone as template")).toBeDefined();
      expect(screen.getByText("Remove")).toBeDefined();
    });
  });

  it("creates new broadcast via Create email button", async () => {
    mockFetchSuccess();
    render(React.createElement(BroadcastsList));

    await waitFor(() => {
      expect(screen.getByText("Create email")).toBeDefined();
    });

    // Mock the POST response
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          id: "bc-new",
          name: "Untitled",
          status: "draft",
          createdAt: new Date().toISOString(),
        }),
    });

    fireEvent.click(screen.getByText("Create email"));

    await waitFor(() => {
      const calls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls;
      const postCall = calls.find(
        (c: unknown[]) =>
          typeof c[1] === "object" &&
          c[1] !== null &&
          (c[1] as Record<string, unknown>).method === "POST",
      );
      expect(postCall).toBeDefined();
      expect(postCall?.[0]).toBe("/api/broadcasts");
    });
  });

  it("audiences filter shows All Audiences plus segment names", async () => {
    mockFetchSuccess();
    render(React.createElement(BroadcastsList));

    await waitFor(() => {
      expect(screen.getByText("All Audiences")).toBeDefined();
    });

    fireEvent.click(screen.getByText("All Audiences"));

    await waitFor(() => {
      expect(screen.getByText("VIP Customers")).toBeDefined();
      expect(screen.getByText("Newsletter")).toBeDefined();
    });
  });

  it("pagination shows page info and items per page", async () => {
    mockFetchSuccess(mockBroadcasts, 100);
    render(React.createElement(BroadcastsList));

    await waitFor(() => {
      expect(screen.getByText("Welcome Email")).toBeDefined();
    });

    // Check pagination info exists
    const pageInfo = screen.getByText(/Page 1/);
    expect(pageInfo).toBeDefined();
  });

  it("syncs search and filters into URL query params", async () => {
    mockFetchSuccess();
    render(React.createElement(BroadcastsList));

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Search...")).toBeDefined();
    });

    const searchInput = screen.getByPlaceholderText("Search...");
    fireEvent.change(searchInput, { target: { value: "broadcast" } });

    await waitFor(() => {
      expect(mockRouter.replace).toHaveBeenCalledWith(
        expect.stringContaining("search=broadcast"),
      );
    });

    const statusTrigger = screen.getByText("All Statuses");
    fireEvent.click(statusTrigger);
    const draftOption = await screen.findByRole("menuitem", { name: "Draft" });
    fireEvent.click(draftOption);
    await waitFor(() => {
      expect(mockRouter.replace).toHaveBeenCalledWith(
        expect.stringContaining("status=draft"),
      );
    });
  });
});
