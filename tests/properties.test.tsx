import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Must import after mocking
import { PropertiesList } from "@/components/properties-list";

describe("PropertiesList", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  const mockProperties = [
    {
      id: "p1",
      name: "company_name",
      type: "string",
      fallback_value: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: "p2",
      name: "employee_count",
      type: "number",
      fallback_value: "0",
      created_at: new Date(Date.now() - 86400000).toISOString(),
      updated_at: new Date(Date.now() - 86400000).toISOString(),
    },
    {
      id: "p3",
      name: "plan_type",
      type: "string",
      fallback_value: "free",
      created_at: new Date(Date.now() - 172800000).toISOString(),
      updated_at: new Date(Date.now() - 172800000).toISOString(),
    },
  ];

  beforeEach(() => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: mockProperties, total: 3 }),
    });
  });

  it("renders property rows with correct columns", async () => {
    render(<PropertiesList />);

    await waitFor(() => {
      expect(screen.getByText("company_name")).toBeTruthy();
    });

    // Check all names render
    expect(screen.getByText("company_name")).toBeTruthy();
    expect(screen.getByText("employee_count")).toBeTruthy();
    expect(screen.getByText("plan_type")).toBeTruthy();

    // Check type column
    expect(screen.getAllByText("string")).toHaveLength(2);
    expect(screen.getByText("number")).toBeTruthy();

    // Check fallback values
    expect(screen.getByText("0")).toBeTruthy();
    expect(screen.getByText("free")).toBeTruthy();

    // Check column headers
    expect(screen.getByText("Name")).toBeTruthy();
    expect(screen.getByText("Type")).toBeTruthy();
    expect(screen.getByText("Fallback value")).toBeTruthy();
    expect(screen.getByText("Created")).toBeTruthy();
  });

  it("add property modal shows Type options", async () => {
    render(<PropertiesList />);

    await waitFor(() => {
      expect(screen.getByText("company_name")).toBeTruthy();
    });

    // Click 'Add property' button
    fireEvent.click(screen.getByText("Add property"));

    // Modal should appear
    await waitFor(() => {
      expect(screen.getByText("Add a new property")).toBeTruthy();
    });

    // Click the type selector to open options
    const typeSelect = screen.getByDisplayValue("String") as HTMLSelectElement;
    expect(typeSelect).toBeTruthy();

    // Verify both options exist
    const options = typeSelect.querySelectorAll("option");
    const optionTexts = Array.from(options).map((o) => o.textContent);
    expect(optionTexts).toContain("String");
    expect(optionTexts).toContain("Number");
  });

  it("search filters properties by name", async () => {
    render(<PropertiesList />);

    await waitFor(() => {
      expect(screen.getByText("company_name")).toBeTruthy();
    });

    const searchInput = screen.getByPlaceholderText("Search...");
    fireEvent.change(searchInput, { target: { value: "company" } });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("search=company"),
      );
    });
  });

  it("type filter narrows by string/number", async () => {
    render(<PropertiesList />);

    await waitFor(() => {
      expect(screen.getByText("company_name")).toBeTruthy();
    });

    const typeFilter = screen.getByDisplayValue("All Types");
    fireEvent.change(typeFilter, { target: { value: "number" } });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("type=number"),
      );
    });
  });

  it("submits new property via add modal", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: mockProperties, total: 3 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            id: "p4",
            name: "phone_number",
            type: "string",
            fallbackValue: null,
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [
              ...mockProperties,
              {
                id: "p4",
                name: "phone_number",
                type: "string",
                fallback_value: null,
                created_at: new Date().toISOString(),
              },
            ],
            total: 4,
          }),
      });

    render(<PropertiesList />);

    await waitFor(() => {
      expect(screen.getByText("company_name")).toBeTruthy();
    });

    fireEvent.click(screen.getByText("Add property"));

    await waitFor(() => {
      expect(screen.getByText("Add a new property")).toBeTruthy();
    });

    const nameInput = screen.getByPlaceholderText("e.g., company_name");
    fireEvent.change(nameInput, { target: { value: "phone_number" } });

    // Click Add button in modal
    const addButton = screen.getByRole("button", { name: "Add" });
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/properties",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("phone_number"),
        }),
      );
    });
  });

  it("shows empty state when no properties exist", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [], total: 0 }),
    });

    render(<PropertiesList />);

    await waitFor(() => {
      expect(screen.getByText("No properties")).toBeTruthy();
    });
  });

  it("name input enforces maxlength of 100", async () => {
    render(<PropertiesList />);

    await waitFor(() => {
      expect(screen.getByText("company_name")).toBeTruthy();
    });

    fireEvent.click(screen.getByText("Add property"));

    await waitFor(() => {
      expect(screen.getByText("Add a new property")).toBeTruthy();
    });

    const nameInput = screen.getByPlaceholderText(
      "e.g., company_name",
    ) as HTMLInputElement;
    expect(nameInput.getAttribute("maxLength")).toBe("100");
  });
});
