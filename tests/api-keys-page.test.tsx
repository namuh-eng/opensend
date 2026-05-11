import type { ApiKeyRow } from "@/components/api-keys-list";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

// We'll import the component after mocks are set up
let ApiKeysList: typeof import("@/components/api-keys-list").ApiKeysList;

beforeEach(async () => {
  const mod = await import("@/components/api-keys-list");
  ApiKeysList = mod.ApiKeysList;
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const mockKeys: ApiKeyRow[] = [
  {
    id: "key-1",
    name: "Production Key",
    tokenPreview: "os_abc...123",
    permission: "full_access",
    lastUsedAt: "2026-03-28T10:00:00Z",
    createdAt: "2026-03-01T10:00:00Z",
  },
  {
    id: "key-2",
    name: "Staging Key",
    tokenPreview: "os_def...456",
    permission: "sending_access",
    lastUsedAt: null,
    createdAt: "2026-03-15T10:00:00Z",
  },
  {
    id: "key-3",
    name: "Dev Key",
    tokenPreview: "os_ghi...789",
    permission: "full_access",
    lastUsedAt: "2026-03-27T10:00:00Z",
    createdAt: "2026-03-20T10:00:00Z",
  },
];

describe("API Keys List Page", () => {
  it("renders page title and create button", () => {
    render(<ApiKeysList keys={mockKeys} domains={[]} />);
    expect(screen.getByText("API Keys")).toBeTruthy();
    expect(screen.getByText("Create API Key")).toBeTruthy();
  });

  it("renders table with correct column headers", () => {
    render(<ApiKeysList keys={mockKeys} domains={[]} />);
    expect(screen.getByText("Name")).toBeTruthy();
    expect(screen.getByText("Token")).toBeTruthy();
    expect(screen.getByText("Permission")).toBeTruthy();
    expect(screen.getByText("Last Used")).toBeTruthy();
    expect(screen.getByText("Created")).toBeTruthy();
  });

  it("renders API key rows with correct data", () => {
    render(<ApiKeysList keys={mockKeys} domains={[]} />);
    expect(screen.getByText("Production Key")).toBeTruthy();
    expect(screen.getByText("Staging Key")).toBeTruthy();
    expect(screen.getByText("Dev Key")).toBeTruthy();
    // Token prefix displayed
    expect(screen.getByText("os_abc...123")).toBeTruthy();
    expect(screen.getByText("os_def...456")).toBeTruthy();
  });

  it("renders permission labels correctly", () => {
    render(<ApiKeysList keys={mockKeys} domains={[]} />);
    const fullAccessCells = screen.getAllByText("Full access");
    expect(fullAccessCells.length).toBe(2);
    expect(screen.getByText("Sending access")).toBeTruthy();
  });

  it("filters by search term on name", () => {
    render(<ApiKeysList keys={mockKeys} domains={[]} />);
    const searchInput = screen.getByPlaceholderText("Search...");
    fireEvent.change(searchInput, { target: { value: "Production" } });
    expect(screen.getByText("Production Key")).toBeTruthy();
    expect(screen.queryByText("Staging Key")).toBeNull();
    expect(screen.queryByText("Dev Key")).toBeNull();
  });

  it("filters by permission type", () => {
    render(<ApiKeysList keys={mockKeys} domains={[]} />);
    // Find and click permissions dropdown
    const permFilter = screen.getByText("All Permissions");
    fireEvent.click(permFilter);
    // The dropdown options include "Sending access" — find the one in the dropdown menu
    const dropdownButtons = screen.getAllByRole("button");
    const sendingBtn = dropdownButtons.find(
      (btn) => btn.textContent?.trim() === "Sending access",
    );
    expect(sendingBtn).toBeTruthy();
    fireEvent.click(sendingBtn as HTMLElement);
    // Only staging key should remain
    expect(screen.getByText("Staging Key")).toBeTruthy();
    expect(screen.queryByText("Production Key")).toBeNull();
  });

  it("shows empty state when no keys exist", () => {
    render(<ApiKeysList keys={[]} domains={[]} />);
    expect(screen.getByText("No API keys yet")).toBeTruthy();
  });

  it("opens create modal when clicking Create API Key button", () => {
    render(<ApiKeysList keys={mockKeys} domains={[]} />);
    fireEvent.click(screen.getByText("Create API Key"));
    expect(screen.getByText("Add API Key")).toBeTruthy();
    expect(screen.getByPlaceholderText("Your API Key name")).toBeTruthy();
  });

  it("create modal has permission and domain fields", () => {
    render(
      <ApiKeysList
        keys={mockKeys}
        domains={[{ id: "d1", name: "example.com" }]}
      />,
    );
    fireEvent.click(screen.getByText("Create API Key"));
    // Modal should have labels for Name, Permission, Domain
    const labels = screen.getAllByText("Name");
    expect(labels.length).toBeGreaterThanOrEqual(2); // table header + modal label
    const permLabels = screen.getAllByText("Permission");
    expect(permLabels.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("Domain")).toBeTruthy();
  });

  it("has checkbox column for bulk selection", () => {
    render(<ApiKeysList keys={mockKeys} domains={[]} />);
    const checkboxes = screen.getAllByRole("checkbox");
    // 1 select-all + 3 row checkboxes
    expect(checkboxes.length).toBe(4);
  });

  it("has three-dot action menu on rows", () => {
    render(<ApiKeysList keys={mockKeys} domains={[]} />);
    const moreButtons = screen.getAllByLabelText("More actions");
    expect(moreButtons.length).toBe(3);
  });
});
