import type { ApiKeyRow } from "@/components/api-keys-list";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

let ApiKeysList: typeof import("@/components/api-keys-list").ApiKeysList;

beforeEach(async () => {
  const mod = await import("@/components/api-keys-list");
  ApiKeysList = mod.ApiKeysList;
  mockFetch.mockReset();
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
    lastUsedAt: null,
    createdAt: "2026-03-01T10:00:00Z",
  },
];

const mockDomains = [
  { id: "d1", name: "example.com" },
  { id: "d2", name: "test.io" },
];

function openCreateModal() {
  render(<ApiKeysList keys={mockKeys} domains={mockDomains} />);
  fireEvent.click(screen.getByText("Create API Key"));
}

describe("Create API Key Modal — feature-031", () => {
  it("domain field is disabled when Full access permission is selected", () => {
    openCreateModal();
    const domainSelect = screen.getByLabelText("Domain") as HTMLSelectElement;
    expect(domainSelect.disabled).toBe(true);
  });

  it("domain field is enabled when Sending access is selected", () => {
    openCreateModal();
    const permSelect = screen.getByLabelText("Permission");
    fireEvent.change(permSelect, { target: { value: "sending_access" } });
    const domainSelect = screen.getByLabelText("Domain") as HTMLSelectElement;
    expect(domainSelect.disabled).toBe(false);
  });

  it("domain field resets to All Domains when switching back to Full access", () => {
    openCreateModal();
    const permSelect = screen.getByLabelText("Permission");
    // Switch to sending access and select a domain
    fireEvent.change(permSelect, { target: { value: "sending_access" } });
    const domainSelect = screen.getByLabelText("Domain") as HTMLSelectElement;
    fireEvent.change(domainSelect, { target: { value: "d1" } });
    expect(domainSelect.value).toBe("d1");
    // Switch back to full access
    fireEvent.change(permSelect, { target: { value: "full_access" } });
    expect((screen.getByLabelText("Domain") as HTMLSelectElement).value).toBe(
      "",
    );
    expect(
      (screen.getByLabelText("Domain") as HTMLSelectElement).disabled,
    ).toBe(true);
  });

  it("domain dropdown shows verified domains", () => {
    openCreateModal();
    const permSelect = screen.getByLabelText("Permission");
    fireEvent.change(permSelect, { target: { value: "sending_access" } });
    expect(screen.getByText("example.com")).toBeTruthy();
    expect(screen.getByText("test.io")).toBeTruthy();
  });

  it("Add button is disabled when name is empty", () => {
    openCreateModal();
    const addBtn = screen.getByRole("button", { name: "Add" });
    expect(addBtn).toBeTruthy();
    expect((addBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it("Add button becomes enabled when name is entered", () => {
    openCreateModal();
    const nameInput = screen.getByPlaceholderText("Your API Key name");
    fireEvent.change(nameInput, { target: { value: "My Key" } });
    const addBtn = screen.getByRole("button", { name: "Add" });
    expect((addBtn as HTMLButtonElement).disabled).toBe(false);
  });

  it("shows the created token after successful creation", async () => {
    openCreateModal();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "new-key",
        name: "My Key",
        token: "os_abc123def456ghi789",
        key_prefix: "os_abc123de...",
        permission: "full_access",
      }),
    });
    const nameInput = screen.getByPlaceholderText("Your API Key name");
    fireEvent.change(nameInput, { target: { value: "My Key" } });
    const addBtn = screen.getByRole("button", { name: "Add" });
    fireEvent.click(addBtn);
    // Wait for the token to appear
    const tokenEl = await screen.findByText("os_abc123def456ghi789");
    expect(tokenEl).toBeTruthy();
  });

  it("token reveal modal warns token is shown only once", async () => {
    openCreateModal();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "new-key",
        name: "My Key",
        token: "os_abc123def456ghi789",
        key_prefix: "os_abc123de...",
        permission: "full_access",
      }),
    });
    const nameInput = screen.getByPlaceholderText("Your API Key name");
    fireEvent.change(nameInput, { target: { value: "My Key" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    const warning = await screen.findByText(/only.*once|never.*again/i);
    expect(warning).toBeTruthy();
  });
});
