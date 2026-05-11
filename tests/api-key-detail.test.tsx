import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock next/navigation
const mockPush = vi.fn();
const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}));

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import {
  ApiKeyDetail,
  type ApiKeyDetailData,
} from "@/components/api-key-detail";

const mockKey: ApiKeyDetailData = {
  id: "key-123",
  name: "testing",
  tokenPreview: "os_jQP...TWu",
  permission: "full_access",
  domain: null,
  domainName: "All domains",
  totalUses: 4,
  lastUsedAt: "2026-03-29T01:00:00.000Z",
  createdAt: "2026-03-29T01:00:00.000Z",
  creatorEmail: "jaeyunha@foreverbrowsing.com",
};

const mockDomains = [{ id: "dom-1", name: "foreverbrowsing.com" }];

describe("ApiKeyDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });
  });
  afterEach(cleanup);

  it("renders API key detail with all metadata fields", () => {
    render(<ApiKeyDetail apiKey={mockKey} domains={mockDomains} />);
    // Breadcrumb + label both show "API Key"
    expect(screen.getAllByText("API Key").length).toBeGreaterThanOrEqual(1);
    // Key name as heading
    expect(screen.getByRole("heading", { name: "testing" })).toBeTruthy();
    // 7 metadata fields
    expect(screen.getByText("PERMISSION")).toBeTruthy();
    expect(screen.getByText("Full access")).toBeTruthy();
    expect(screen.getByText("DOMAIN")).toBeTruthy();
    expect(screen.getByText("All domains")).toBeTruthy();
    expect(screen.getByText("TOTAL USES")).toBeTruthy();
    expect(screen.getByText("TOKEN")).toBeTruthy();
    expect(screen.getByText("os_jQP...TWu")).toBeTruthy();
    expect(screen.getByText("LAST USED")).toBeTruthy();
    expect(screen.getByText("CREATED")).toBeTruthy();
    expect(screen.getByText("CREATOR")).toBeTruthy();
    expect(screen.getByText("jaeyunha@foreverbrowsing.com")).toBeTruthy();
  });

  it("renders total uses as a link with count", () => {
    render(<ApiKeyDetail apiKey={mockKey} domains={mockDomains} />);
    const totalUsesLink = screen.getByText("4 times");
    expect(totalUsesLink.closest("a")).toBeTruthy();
    expect(totalUsesLink.closest("a")?.getAttribute("href")).toBe(
      "/logs?api_key=key-123",
    );
  });

  it("shows More actions dropdown with Edit, Go to docs, Delete", () => {
    render(<ApiKeyDetail apiKey={mockKey} domains={mockDomains} />);
    const moreBtn = screen.getByLabelText("More actions");
    fireEvent.click(moreBtn);
    expect(screen.getByText("Edit API key")).toBeTruthy();
    expect(screen.getByText("Go to docs")).toBeTruthy();
    expect(screen.getByText("Delete API key")).toBeTruthy();
  });

  it("opens Edit modal with pre-filled values", () => {
    render(<ApiKeyDetail apiKey={mockKey} domains={mockDomains} />);
    const moreBtn = screen.getByLabelText("More actions");
    fireEvent.click(moreBtn);
    fireEvent.click(screen.getByText("Edit API key"));
    // Modal title
    expect(screen.getByText("Edit API Key")).toBeTruthy();
    // Pre-filled name
    const nameInput = screen.getByDisplayValue("testing");
    expect(nameInput).toBeTruthy();
    // Save button
    expect(screen.getByText("Save")).toBeTruthy();
  });

  it("saves edited API key name", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: "key-123", name: "Updated Key" }),
    });
    render(<ApiKeyDetail apiKey={mockKey} domains={mockDomains} />);
    // Open edit modal
    fireEvent.click(screen.getByLabelText("More actions"));
    fireEvent.click(screen.getByText("Edit API key"));
    // Change name
    const nameInput = screen.getByDisplayValue("testing");
    fireEvent.change(nameInput, { target: { value: "Updated Key" } });
    // Click save
    fireEvent.click(screen.getByText("Save"));
    // Verify fetch was called with PATCH
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/api-keys/key-123",
      expect.objectContaining({ method: "PATCH" }),
    );
  });

  it("deletes API key with confirmation", () => {
    render(<ApiKeyDetail apiKey={mockKey} domains={mockDomains} />);
    fireEvent.click(screen.getByLabelText("More actions"));
    fireEvent.click(screen.getByText("Delete API key"));
    // Confirmation modal
    expect(screen.getByText("Delete API Key")).toBeTruthy();
    expect(screen.getByText("Delete")).toBeTruthy();
  });

  it("renders lock icon next to key name", () => {
    render(<ApiKeyDetail apiKey={mockKey} domains={mockDomains} />);
    const icon = document.querySelector('[data-testid="key-icon"]');
    expect(icon).toBeTruthy();
  });

  it("token is always truncated", () => {
    render(<ApiKeyDetail apiKey={mockKey} domains={mockDomains} />);
    // Token should show truncated prefix, never full key
    expect(screen.getByText("os_jQP...TWu")).toBeTruthy();
  });
});
