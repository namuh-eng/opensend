import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
  useParams: () => ({ id: "test-broadcast-id" }),
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

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

function setupMockFetch() {
  mockFetch.mockImplementation((url: string) => {
    if (typeof url === "string" && url.includes("/api/broadcasts/")) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            id: "test-broadcast-id",
            name: "Untitled",
            from: "",
            replyTo: "",
            subject: "",
            previewText: "",
            html: "",
            status: "draft",
            segmentId: null,
            topicId: null,
            scheduledAt: null,
          }),
      });
    }
    if (typeof url === "string" && url.includes("/api/domains")) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      });
    }
    if (typeof url === "string" && url.includes("/api/segments")) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      });
    }
    if (typeof url === "string" && url.includes("/api/topics")) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      });
    }
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({}),
    });
  });
}

describe("BroadcastEditor — Block Editor", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    setupMockFetch();
  });

  afterEach(() => {
    cleanup();
    vi.resetModules();
  });

  it("shows slash command menu with all block types when '/' is typed", async () => {
    const { BroadcastEditor } = await import("@/components/broadcast-editor");

    await act(async () => {
      render(<BroadcastEditor broadcastId="test-broadcast-id" />);
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    // Find the editor area and type /
    const editorArea = screen.getByTestId("block-editor");
    expect(editorArea).toBeDefined();

    await act(async () => {
      fireEvent.keyDown(editorArea, { key: "/" });
    });

    // Should show slash command menu with 4 categories
    // "Text" appears in both slash menu category and toolbar tab, so use getAllByText
    const textElements = screen.getAllByText("Text");
    expect(textElements.length).toBeGreaterThanOrEqual(2); // category + toolbar tab
    // Media category (only in slash menu)
    expect(screen.getByText("Media")).toBeDefined();
    // Layout category
    expect(screen.getByText("Layout")).toBeDefined();
    // Utility category
    expect(screen.getByText("Utility")).toBeDefined();

    // Text block types
    expect(screen.getByText("Title")).toBeDefined();
    expect(screen.getByText("Subtitle")).toBeDefined();
    expect(screen.getByText("Heading")).toBeDefined();
    // These appear in both slash menu and toolbar, use getAllByText
    expect(screen.getAllByText("Bullet list").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Numbered list").length).toBeGreaterThanOrEqual(
      1,
    );
    expect(screen.getByText("Quote")).toBeDefined();
    expect(screen.getByText("Code block")).toBeDefined();

    // Media block types — "Image" also appears as toolbar tab
    expect(screen.getAllByText("Image").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("YouTube")).toBeDefined();

    // Layout block types — "Button" and "Divider" also in Components tab
    expect(screen.getAllByText("Button").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Divider").length).toBeGreaterThanOrEqual(1);
  });

  it("inserts a heading block when selecting Heading from slash menu", async () => {
    const { BroadcastEditor } = await import("@/components/broadcast-editor");

    await act(async () => {
      render(<BroadcastEditor broadcastId="test-broadcast-id" />);
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    const editorArea = screen.getByTestId("block-editor");

    // Open slash menu
    await act(async () => {
      fireEvent.keyDown(editorArea, { key: "/" });
    });

    // Click Heading
    const headingOption = screen.getByText("Heading");
    await act(async () => {
      fireEvent.click(headingOption);
    });

    // Slash menu should close
    expect(screen.queryByText("Bullet list")).toBeNull();

    // A heading block should exist
    const headingBlock = screen.getByTestId("block-heading");
    expect(headingBlock).toBeDefined();
  });

  it("variables tab shows contact properties and system variables", async () => {
    const { BroadcastEditor } = await import("@/components/broadcast-editor");

    await act(async () => {
      render(<BroadcastEditor broadcastId="test-broadcast-id" />);
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    // Click Variables toolbar tab
    const variablesTab = screen.getByRole("button", { name: "Variables" });
    await act(async () => {
      fireEvent.click(variablesTab);
    });

    // Should show contact properties
    expect(screen.getByText("{{{contact.first_name}}}")).toBeDefined();
    expect(screen.getByText("{{{contact.last_name}}}")).toBeDefined();
    expect(screen.getByText("{{{contact.email}}}")).toBeDefined();
    expect(screen.getByText("{{{contact.company_name}}}")).toBeDefined();
    // System variable
    expect(screen.getByText("{{{OPENSEND_UNSUBSCRIBE_URL}}}")).toBeDefined();
  });

  it("bottom toolbar has Text, Image, Components, Variables tabs", async () => {
    const { BroadcastEditor } = await import("@/components/broadcast-editor");

    await act(async () => {
      render(<BroadcastEditor broadcastId="test-broadcast-id" />);
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    // Bottom toolbar tabs
    expect(screen.getByRole("button", { name: "Text" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Image" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Components" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Variables" })).toBeDefined();
  });

  it("text toolbar shows formatting buttons", async () => {
    const { BroadcastEditor } = await import("@/components/broadcast-editor");

    await act(async () => {
      render(<BroadcastEditor broadcastId="test-broadcast-id" />);
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    // Text tab should be active by default showing formatting options
    const textTab = screen.getByRole("button", { name: "Text" });
    await act(async () => {
      fireEvent.click(textTab);
    });

    // Bold, Italic, Underline buttons
    expect(screen.getByTitle("Bold")).toBeDefined();
    expect(screen.getByTitle("Italic")).toBeDefined();
    expect(screen.getByTitle("Underline")).toBeDefined();
  });

  it("inserting a text block via slash menu adds editable text area", async () => {
    const { BroadcastEditor } = await import("@/components/broadcast-editor");

    await act(async () => {
      render(<BroadcastEditor broadcastId="test-broadcast-id" />);
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    const editorArea = screen.getByTestId("block-editor");

    // Open slash menu
    await act(async () => {
      fireEvent.keyDown(editorArea, { key: "/" });
    });

    // Click "Quote"
    const quoteOption = screen.getByText("Quote");
    await act(async () => {
      fireEvent.click(quoteOption);
    });

    // A quote block should appear
    const quoteBlock = screen.getByTestId("block-quote");
    expect(quoteBlock).toBeDefined();
  });

  it("components tab shows layout block types", async () => {
    const { BroadcastEditor } = await import("@/components/broadcast-editor");

    await act(async () => {
      render(<BroadcastEditor broadcastId="test-broadcast-id" />);
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    // Click Components tab
    const componentsTab = screen.getByRole("button", { name: "Components" });
    await act(async () => {
      fireEvent.click(componentsTab);
    });

    // Should show layout/component options
    expect(screen.getByText("Button")).toBeDefined();
    expect(screen.getByText("Divider")).toBeDefined();
    expect(screen.getByText("HTML")).toBeDefined();
  });

  it("shows Pick a template and Upload HTML buttons", async () => {
    const { BroadcastEditor } = await import("@/components/broadcast-editor");

    await act(async () => {
      render(<BroadcastEditor broadcastId="test-broadcast-id" />);
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(screen.getByText("Pick a template")).toBeDefined();
    expect(screen.getByText("Upload HTML")).toBeDefined();
  });
});
