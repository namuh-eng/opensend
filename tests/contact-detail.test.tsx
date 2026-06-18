import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/audience/contacts/test-id",
}));

// Mock clipboard API
Object.assign(navigator, {
  clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
});

import { ContactDetail } from "@/components/contact-detail";

const mockContact = {
  id: "3e34ce07-24e7-475f-b22c-33abcdef1234",
  email: "test@example.com",
  firstName: "John",
  lastName: "Doe",
  status: "subscribed" as const,
  segments: [] as Array<{ id: string; name: string }>,
  topics: [] as Array<{ id: string; name: string }>,
  properties: {
    first_name: "John",
    last_name: "Doe",
    company_name: "Acme Inc",
  },
  createdAt: "2026-03-29T10:00:00.000Z",
  activity: [
    { type: "Contact created", timestamp: "2026-03-29T10:00:00.000Z" },
  ],
};

afterEach(() => {
  cleanup();
});

describe("ContactDetail", () => {
  it("renders contact metadata fields", () => {
    render(<ContactDetail contact={mockContact} />);

    // Header
    expect(screen.getByText("Contact")).toBeDefined();
    // Email appears in header and metadata
    expect(
      screen.getAllByText("test@example.com").length,
    ).toBeGreaterThanOrEqual(1);

    // Metadata labels
    expect(screen.getByText("EMAIL ADDRESS")).toBeDefined();
    expect(screen.getByText("CREATED")).toBeDefined();
    expect(screen.getByText("STATUS")).toBeDefined();
    expect(screen.getByText("ID")).toBeDefined();
    expect(screen.getByText("SEGMENTS")).toBeDefined();
    expect(screen.getByText("TOPICS")).toBeDefined();

    // Values
    expect(screen.getByText("Subscribed")).toBeDefined();
    expect(screen.getByText("No segments")).toBeDefined();
    expect(screen.getByText("No topics")).toBeDefined();
  });

  it("renders contact metadata with segments and topics", () => {
    const contactWithSegments = {
      ...mockContact,
      segments: [
        { id: "s1", name: "VIP" },
        { id: "s2", name: "Newsletter" },
      ],
      topics: [{ id: "t1", name: "Product Updates" }],
    };

    render(<ContactDetail contact={contactWithSegments} />);

    expect(screen.getByText("VIP")).toBeDefined();
    expect(screen.getByText("Newsletter")).toBeDefined();
    expect(screen.getByText("Product Updates")).toBeDefined();
  });

  it("renders properties section", () => {
    render(<ContactDetail contact={mockContact} />);

    expect(screen.getByText("Properties")).toBeDefined();

    // Property labels
    expect(screen.getByText("FIRST_NAME")).toBeDefined();
    expect(screen.getByText("LAST_NAME")).toBeDefined();
    expect(screen.getByText("COMPANY_NAME")).toBeDefined();

    // Property values
    expect(screen.getAllByText("John").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Doe").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Acme Inc")).toBeDefined();
  });

  it("renders activity timeline", () => {
    render(<ContactDetail contact={mockContact} />);

    expect(screen.getByText("Activity")).toBeDefined();
    expect(screen.getByText("Contact created")).toBeDefined();
    expect(
      screen.getByText("Activity data may take a few seconds to update."),
    ).toBeDefined();
  });

  it("renders unsubscribed status", () => {
    const unsubscribed = { ...mockContact, status: "unsubscribed" as const };
    render(<ContactDetail contact={unsubscribed} />);

    expect(screen.getByText("Unsubscribed")).toBeDefined();
  });

  it("renders contact ID with copy button", () => {
    render(<ContactDetail contact={mockContact} />);

    // ID value is displayed (truncated in UI but full in the component)
    const idText = screen.getByText(mockContact.id);
    expect(idText).toBeDefined();
  });

  // --- Behavioral: these fail on the previous dead `() => {}` handlers ---

  it("opens the edit modal when Edit contact is clicked", () => {
    render(<ContactDetail contact={mockContact} />);

    fireEvent.click(screen.getByRole("button", { name: "More actions" }));
    fireEvent.click(screen.getByText("Edit contact"));

    // Edit modal heading + seeded fields appear
    expect(
      screen
        .getByRole("dialog", { name: "Edit contact" })
        .getAttribute("aria-modal"),
    ).toBe("true");
    expect(screen.getByRole("heading", { name: "Edit contact" })).toBeDefined();
    expect(
      (screen.getByLabelText("First name") as HTMLInputElement).value,
    ).toBe("John");
    expect((screen.getByLabelText("Last name") as HTMLInputElement).value).toBe(
      "Doe",
    );
  });

  it("focuses safe dialog actions and closes dialogs with Escape", async () => {
    render(<ContactDetail contact={mockContact} />);

    fireEvent.click(screen.getByRole("button", { name: "More actions" }));
    fireEvent.click(screen.getByText("Edit contact"));

    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByLabelText("First name"));
    });

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Edit contact" })).toBeNull();
    });

    fireEvent.click(screen.getByRole("button", { name: "More actions" }));
    fireEvent.click(screen.getByText("Delete contact"));

    expect(
      screen
        .getByRole("dialog", { name: "Delete contact" })
        .getAttribute("aria-modal"),
    ).toBe("true");
    await waitFor(() => {
      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: "Cancel" }),
      );
    });

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Delete contact" }),
      ).toBeNull();
    });
  });

  it("calls the delete API when deletion is confirmed", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);

    render(<ContactDetail contact={mockContact} />);

    fireEvent.click(screen.getByRole("button", { name: "More actions" }));
    fireEvent.click(screen.getByText("Delete contact"));

    // Confirm dialog, then confirm
    expect(
      screen.getByRole("dialog", { name: "Delete contact" }),
    ).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(fetchMock).toHaveBeenCalledWith(
      `/api/contacts/${mockContact.id}`,
      expect.objectContaining({ method: "DELETE" }),
    );

    vi.unstubAllGlobals();
  });
});
