import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const routerMock = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => routerMock,
}));

// Mock next/link
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

import { TemplatesList } from "@/components/templates-list";

const mockTemplates = [
  {
    id: "t1",
    name: "Welcome Email",
    alias: "welcome-email",
    published: true,
    createdAt: "2026-03-28T12:00:00Z",
  },
  {
    id: "t2",
    name: "Reset Password",
    alias: "reset-password",
    published: false,
    createdAt: "2026-03-27T10:00:00Z",
  },
  {
    id: "t3",
    name: "Invoice Template",
    alias: "invoice-template",
    published: true,
    createdAt: "2026-03-26T08:00:00Z",
  },
];

describe("TemplatesList", () => {
  beforeEach(() => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: mockTemplates, total: 3 }),
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders template cards with name and alias", async () => {
    render(<TemplatesList />);

    expect(await screen.findByText("Welcome Email")).toBeTruthy();
    expect(screen.getByText("welcome-email")).toBeTruthy();
    expect(screen.getByText("Reset Password")).toBeTruthy();
    expect(screen.getByText("reset-password")).toBeTruthy();
    expect(screen.getByText("Invoice Template")).toBeTruthy();
    expect(screen.getByText("invoice-template")).toBeTruthy();
  });

  it("renders template cards as links to editor", async () => {
    render(<TemplatesList />);

    await screen.findByText("Welcome Email");

    const link = screen.getByText("Welcome Email").closest("a");
    expect(link).toBeTruthy();
    expect(link?.getAttribute("href")).toBe("/templates/t1/editor");
  });

  it("shows status filter with All Statuses, Draft, Published options", async () => {
    render(<TemplatesList />);

    await screen.findByText("Welcome Email");

    const statusButton = screen.getByText("All Statuses");
    fireEvent.click(statusButton);

    expect(screen.getByRole("menuitem", { name: "All Statuses" })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "Draft" })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "Published" })).toBeTruthy();
  });

  it("renders search input", async () => {
    render(<TemplatesList />);

    await screen.findByText("Welcome Email");

    expect(screen.getByPlaceholderText("Search...")).toBeTruthy();
  });

  it("renders Create template button", async () => {
    render(<TemplatesList />);

    await screen.findByText("Welcome Email");

    expect(screen.getByText("Create template")).toBeTruthy();
  });

  it("creates a draft template and navigates to its editor from the CTA", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockTemplates, total: 3 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "new-template" }),
      });

    render(<TemplatesList />);

    await screen.findByText("Welcome Email");
    fireEvent.click(screen.getByRole("button", { name: "Create template" }));

    await waitFor(() => {
      expect(routerMock.push).toHaveBeenCalledWith(
        "/templates/new-template/editor",
      );
    });
    expect(mockFetch).toHaveBeenLastCalledWith(
      "/api/templates",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          name: "Untitled Template",
          html: "<p>Start writing your email template.</p>",
        }),
      }),
    );
  });

  it("shows card action menu with options", async () => {
    render(<TemplatesList />);

    await screen.findByText("Welcome Email");

    const actionButtons = screen.getAllByLabelText("More actions");
    fireEvent.click(actionButtons[0]);

    expect(screen.getByText("View details")).toBeTruthy();
    expect(screen.getByText("Edit template")).toBeTruthy();
    expect(screen.getByText("Rename template")).toBeTruthy();
    expect(screen.getByText("Duplicate template")).toBeTruthy();
    expect(screen.getByText("Remove template")).toBeTruthy();
  });

  it("shows empty state when no templates", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [], total: 0 }),
    });

    render(<TemplatesList />);

    expect(await screen.findByText("No templates")).toBeTruthy();
  });

  it("shows preview thumbnail area on each card", async () => {
    render(<TemplatesList />);

    await screen.findByText("Welcome Email");

    const cards = screen.getAllByTestId("template-card");
    expect(cards).toHaveLength(3);
  });

  it("filters templates by status when Draft is selected", async () => {
    render(<TemplatesList />);

    await screen.findByText("Welcome Email");

    const statusButton = screen.getByText("All Statuses");
    fireEvent.click(statusButton);
    fireEvent.click(screen.getByRole("menuitem", { name: "Draft" }));

    // After filtering, only draft templates should show
    expect(screen.getByText("Reset Password")).toBeTruthy();
    expect(screen.queryByText("Welcome Email")).toBeNull();
  });
});
