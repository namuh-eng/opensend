import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/audience/segments",
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

// We'll import the component after setting up the fetch mock
let SegmentsList: typeof import("@/components/segments-list").SegmentsList;

// Matches the snake_case shape returned by GET /api/segments.
const mockSegments = [
  {
    id: "seg-1",
    name: "VIP Customers",
    contacts_count: 42,
    unsubscribed_count: 3,
    created_at: new Date().toISOString(),
  },
  {
    id: "seg-2",
    name: "Newsletter",
    contacts_count: 150,
    unsubscribed_count: 10,
    created_at: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: "seg-3",
    name: "Beta Testers",
    contacts_count: 25,
    unsubscribed_count: 0,
    created_at: new Date(Date.now() - 172800000).toISOString(),
  },
];

function mockFetchSuccess(data: unknown[] = mockSegments, total?: number) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ data, total: total ?? data.length }),
  });
}

describe("SegmentsList", () => {
  beforeEach(async () => {
    vi.resetModules();
    const mod = await import("@/components/segments-list");
    SegmentsList = mod.SegmentsList;
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders segment rows with correct columns", async () => {
    mockFetchSuccess();
    render(React.createElement(SegmentsList));

    await waitFor(() => {
      expect(screen.getByText("VIP Customers")).toBeDefined();
    });

    // Check all segments rendered
    expect(screen.getByText("Newsletter")).toBeDefined();
    expect(screen.getByText("Beta Testers")).toBeDefined();

    // Check contacts count column
    expect(screen.getByText("42")).toBeDefined();
    expect(screen.getByText("150")).toBeDefined();
    expect(screen.getByText("25")).toBeDefined();

    // Check unsubscribed count column
    expect(screen.getByText("3")).toBeDefined();
    expect(screen.getByText("10")).toBeDefined();
    expect(screen.getByText("0")).toBeDefined();
  });

  it("renders column headers: Name, Contacts, Unsubscribed, Created", async () => {
    mockFetchSuccess();
    render(React.createElement(SegmentsList));

    await waitFor(() => {
      expect(screen.getByText("Name")).toBeDefined();
    });
    expect(screen.getByText("Contacts")).toBeDefined();
    expect(screen.getByText("Unsubscribed")).toBeDefined();
    expect(screen.getByText("Created")).toBeDefined();
  });

  it("shows empty state when no segments", async () => {
    mockFetchSuccess([], 0);
    render(React.createElement(SegmentsList));

    await waitFor(() => {
      expect(screen.getByText("No segments")).toBeDefined();
    });
  });

  it("has a Create segment button", async () => {
    mockFetchSuccess();
    render(React.createElement(SegmentsList));

    await waitFor(() => {
      expect(screen.getByText("Create segment")).toBeDefined();
    });
  });

  it("opens create segment modal on button click", async () => {
    mockFetchSuccess();
    render(React.createElement(SegmentsList));

    await waitFor(() => {
      expect(screen.getByText("Create segment")).toBeDefined();
    });

    fireEvent.click(screen.getByText("Create segment"));

    await waitFor(() => {
      expect(screen.getByText("Create a new segment")).toBeDefined();
    });

    // Check modal has name input with placeholder
    const nameInput = screen.getByPlaceholderText("Your segment name");
    expect(nameInput).toBeDefined();

    // Check modal has Add and Cancel buttons
    expect(screen.getByText("Add")).toBeDefined();
    expect(screen.getByText("Cancel")).toBeDefined();
  });

  it("segment name links to /audience?segmentId=:id", async () => {
    mockFetchSuccess();
    render(React.createElement(SegmentsList));

    await waitFor(() => {
      expect(screen.getByText("VIP Customers")).toBeDefined();
    });

    const link = screen.getByText("VIP Customers").closest("a");
    expect(link?.getAttribute("href")).toBe("/audience?segmentId=seg-1");
  });

  it("search input has Search... placeholder", async () => {
    mockFetchSuccess();
    render(React.createElement(SegmentsList));

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Search...")).toBeDefined();
    });
  });

  it("creates a segment via POST /api/segments", async () => {
    mockFetchSuccess();
    render(React.createElement(SegmentsList));

    await waitFor(() => {
      expect(screen.getByText("Create segment")).toBeDefined();
    });

    fireEvent.click(screen.getByText("Create segment"));

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Your segment name")).toBeDefined();
    });

    const nameInput = screen.getByPlaceholderText("Your segment name");
    fireEvent.change(nameInput, { target: { value: "New Segment" } });

    // Mock the POST response
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          id: "seg-new",
          name: "New Segment",
          createdAt: new Date().toISOString(),
        }),
    });

    fireEvent.click(screen.getByText("Add"));

    await waitFor(() => {
      const calls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls;
      const postCall = calls.find(
        (c: unknown[]) =>
          typeof c[1] === "object" &&
          c[1] !== null &&
          (c[1] as Record<string, unknown>).method === "POST",
      );
      expect(postCall).toBeDefined();
      expect(postCall?.[0]).toBe("/api/segments");
      const body = JSON.parse((postCall?.[1] as Record<string, string>).body);
      expect(body.name).toBe("New Segment");
    });
  });

  it("has checkbox column for row selection", async () => {
    mockFetchSuccess();
    render(React.createElement(SegmentsList));

    await waitFor(() => {
      expect(screen.getByText("VIP Customers")).toBeDefined();
    });

    // Select all checkbox + one per row = 4 checkboxes
    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes.length).toBe(4); // 1 header + 3 rows
  });
});
