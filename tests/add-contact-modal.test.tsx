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

import { AddContactModal } from "@/components/add-contact-modal";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("AddContactModal", () => {
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    onSuccess: vi.fn(),
  };

  beforeEach(() => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });
  });

  it("renders modal with title and fields when open", () => {
    render(<AddContactModal {...defaultProps} />);

    expect(screen.getByText("Add contacts")).toBeDefined();
    expect(
      screen.getByPlaceholderText("foo@gmail.com, bar@gmail.com"),
    ).toBeDefined();
    expect(
      screen.getByText(
        "Use commas or line breaks to separate multiple email addresses.",
      ),
    ).toBeDefined();
  });

  it("does not render when closed", () => {
    render(<AddContactModal {...defaultProps} open={false} />);

    expect(screen.queryByText("Add contacts")).toBeNull();
  });

  it("has Add and Cancel buttons", () => {
    render(<AddContactModal {...defaultProps} />);

    expect(screen.getByRole("button", { name: "Add" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDefined();
  });

  it("has a close (X) button", () => {
    render(<AddContactModal {...defaultProps} />);

    const closeButton = screen.getByRole("button", { name: /close/i });
    expect(closeButton).toBeDefined();
  });

  it("calls onClose when Cancel is clicked", () => {
    render(<AddContactModal {...defaultProps} />);

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when X button is clicked", () => {
    render(<AddContactModal {...defaultProps} />);

    fireEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it("submits single email via POST to /api/contacts", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ created: 1 }),
      });

    render(<AddContactModal {...defaultProps} />);

    const textarea = screen.getByPlaceholderText(
      "foo@gmail.com, bar@gmail.com",
    );
    fireEvent.change(textarea, { target: { value: "new@example.com" } });

    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => {
      const postCall = mockFetch.mock.calls.find(
        (call: unknown[]) =>
          call[0] === "/api/contacts" &&
          (call[1] as RequestInit)?.method === "POST",
      );
      expect(postCall).toBeDefined();
      const body = JSON.parse((postCall?.[1] as RequestInit).body as string);
      expect(body.email).toBe("new@example.com");
    });
  });

  it("parses comma-separated emails and submits one API-compatible request per contact", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: "contact-1" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: "contact-2" }),
      });

    render(<AddContactModal {...defaultProps} />);

    const textarea = screen.getByPlaceholderText(
      "foo@gmail.com, bar@gmail.com",
    );
    fireEvent.change(textarea, { target: { value: "a@b.com, c@d.com" } });

    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => {
      const postCalls = mockFetch.mock.calls.filter(
        (call: unknown[]) =>
          call[0] === "/api/contacts" &&
          (call[1] as RequestInit)?.method === "POST",
      );
      expect(postCalls).toHaveLength(2);
      expect(
        postCalls.map((call) =>
          JSON.parse((call[1] as RequestInit).body as string),
        ),
      ).toEqual([
        { email: "a@b.com", segments: [] },
        { email: "c@d.com", segments: [] },
      ]);
    });
  });

  it("parses newline-separated emails", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: "contact-1" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: "contact-2" }),
      });

    render(<AddContactModal {...defaultProps} />);

    const textarea = screen.getByPlaceholderText(
      "foo@gmail.com, bar@gmail.com",
    );
    fireEvent.change(textarea, { target: { value: "a@b.com\nc@d.com" } });

    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => {
      const postCalls = mockFetch.mock.calls.filter(
        (call: unknown[]) =>
          call[0] === "/api/contacts" &&
          (call[1] as RequestInit)?.method === "POST",
      );
      expect(
        postCalls.map(
          (call) => JSON.parse((call[1] as RequestInit).body as string).email,
        ),
      ).toEqual(["a@b.com", "c@d.com"]);
    });
  });

  it("calls onSuccess after successful submission", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ created: 1 }),
      });

    render(<AddContactModal {...defaultProps} />);

    const textarea = screen.getByPlaceholderText(
      "foo@gmail.com, bar@gmail.com",
    );
    fireEvent.change(textarea, { target: { value: "test@example.com" } });

    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => {
      expect(defaultProps.onSuccess).toHaveBeenCalled();
    });
  });

  it("does not submit when textarea is empty", () => {
    render(<AddContactModal {...defaultProps} />);

    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    const postCalls = mockFetch.mock.calls.filter(
      (call: unknown[]) =>
        call[0] === "/api/contacts" &&
        (call[1] as RequestInit)?.method === "POST",
    );
    expect(postCalls).toHaveLength(0);
  });

  it("fetches segments on open", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve([
          { id: "s1", name: "VIP" },
          { id: "s2", name: "Newsletter" },
        ]),
    });

    render(<AddContactModal {...defaultProps} />);

    await waitFor(() => {
      const segmentCall = mockFetch.mock.calls.find(
        (call: unknown[]) =>
          typeof call[0] === "string" &&
          (call[0] as string).includes("/api/segments"),
      );
      expect(segmentCall).toBeDefined();
    });
  });

  it("normalizes list-envelope segment responses on open", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          object: "list",
          data: [{ id: "s1", name: "VIP" }],
          has_more: false,
        }),
    });

    render(<AddContactModal {...defaultProps} />);

    const segmentInput = screen.getByPlaceholderText("Search segments...");
    fireEvent.focus(segmentInput);
    fireEvent.change(segmentInput, { target: { value: "VIP" } });

    await waitFor(() => {
      expect(screen.getByText("VIP")).toBeDefined();
    });
  });

  it("sends segments in request body when segments selected", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([{ id: "s1", name: "VIP" }]),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ created: 1 }),
      });

    render(<AddContactModal {...defaultProps} />);

    // Wait for segments to load
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    const textarea = screen.getByPlaceholderText(
      "foo@gmail.com, bar@gmail.com",
    );
    fireEvent.change(textarea, { target: { value: "test@example.com" } });

    // Type in segment search to filter and select
    const segmentInput = screen.getByPlaceholderText("Search segments...");
    fireEvent.focus(segmentInput);
    fireEvent.change(segmentInput, { target: { value: "VIP" } });

    await waitFor(() => {
      const option = screen.getByText("VIP");
      fireEvent.click(option);
    });

    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => {
      const postCall = mockFetch.mock.calls.find(
        (call: unknown[]) =>
          call[0] === "/api/contacts" &&
          (call[1] as RequestInit)?.method === "POST",
      );
      expect(postCall).toBeDefined();
      const body = JSON.parse((postCall?.[1] as RequestInit).body as string);
      expect(body.segments).toEqual(["s1"]);
    });
  });
});
