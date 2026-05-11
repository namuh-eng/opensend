import { CopyToClipboard } from "@/components/copy-to-clipboard";
import { EmptyState } from "@/components/empty-state";
import { Modal } from "@/components/modal";
import { Pagination } from "@/components/pagination";
import { StatusBadge } from "@/components/status-badge";
import { Tabs } from "@/components/tabs";
import { Toast, ToastProvider, useToast } from "@/components/toast";
import { Toggle } from "@/components/toggle";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  cleanup();
});

// ── Pagination ──────────────────────────────────────────────────────────

describe("Pagination", () => {
  it("renders page info with correct format", () => {
    render(
      <Pagination
        page={1}
        totalItems={120}
        pageSize={40}
        onPageChange={() => {}}
        onPageSizeChange={() => {}}
      />,
    );
    expect(screen.getByText(/Page 1/)).toBeTruthy();
    expect(screen.getByText(/120/)).toBeTruthy();
  });

  it("changes items per page when selecting a different size", () => {
    const onPageSizeChange = vi.fn();
    render(
      <Pagination
        page={1}
        totalItems={120}
        pageSize={40}
        onPageChange={() => {}}
        onPageSizeChange={onPageSizeChange}
      />,
    );
    // Click the page size selector to open dropdown
    const selector = screen.getByText("40 items");
    fireEvent.click(selector);
    // Select 80
    const option80 = screen.getByText("80 items");
    fireEvent.click(option80);
    expect(onPageSizeChange).toHaveBeenCalledWith(80);
  });

  it("disables previous button on first page", () => {
    render(
      <Pagination
        page={1}
        totalItems={120}
        pageSize={40}
        onPageChange={() => {}}
        onPageSizeChange={() => {}}
      />,
    );
    const prevButton = screen.getByLabelText(
      "Previous page",
    ) as HTMLButtonElement;
    expect(prevButton.disabled).toBe(true);
  });

  it("disables next button on last page", () => {
    render(
      <Pagination
        page={3}
        totalItems={120}
        pageSize={40}
        onPageChange={() => {}}
        onPageSizeChange={() => {}}
      />,
    );
    const nextButton = screen.getByLabelText("Next page") as HTMLButtonElement;
    expect(nextButton.disabled).toBe(true);
  });

  it("calls onPageChange when navigating", () => {
    const onPageChange = vi.fn();
    render(
      <Pagination
        page={2}
        totalItems={120}
        pageSize={40}
        onPageChange={onPageChange}
        onPageSizeChange={() => {}}
      />,
    );
    fireEvent.click(screen.getByLabelText("Next page"));
    expect(onPageChange).toHaveBeenCalledWith(3);
    fireEvent.click(screen.getByLabelText("Previous page"));
    expect(onPageChange).toHaveBeenCalledWith(1);
  });
});

// ── Modal ───────────────────────────────────────────────────────────────

describe("Modal", () => {
  it("renders title and children when open", () => {
    render(
      <Modal open={true} onClose={() => {}} title="Add contacts">
        <p>Modal body</p>
      </Modal>,
    );
    expect(screen.getByText("Add contacts")).toBeTruthy();
    expect(screen.getByText("Modal body")).toBeTruthy();
  });

  it("does not render when closed", () => {
    render(
      <Modal open={false} onClose={() => {}} title="Hidden modal">
        <p>Should not appear</p>
      </Modal>,
    );
    expect(screen.queryByText("Hidden modal")).toBeNull();
  });

  it("calls onClose when Cancel button is clicked", () => {
    const onClose = vi.fn();
    render(
      <Modal open={true} onClose={onClose} title="Test">
        <p>Body</p>
      </Modal>,
    );
    fireEvent.click(screen.getByText("Cancel"));
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose when Escape key is pressed", () => {
    const onClose = vi.fn();
    render(
      <Modal open={true} onClose={onClose} title="Test">
        <p>Body</p>
      </Modal>,
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("renders action button when provided", () => {
    const onAction = vi.fn();
    render(
      <Modal
        open={true}
        onClose={() => {}}
        title="Test"
        actionLabel="Add"
        onAction={onAction}
      >
        <p>Body</p>
      </Modal>,
    );
    const addButton = screen.getByText("Add");
    fireEvent.click(addButton);
    expect(onAction).toHaveBeenCalled();
  });
});

// ── Toast ───────────────────────────────────────────────────────────────

describe("Toast", () => {
  it("renders success toast with message", () => {
    render(<Toast message="Email sent" type="success" onDismiss={() => {}} />);
    expect(screen.getByText("Email sent")).toBeTruthy();
  });

  it("renders error toast with message", () => {
    render(
      <Toast message="Failed to send" type="error" onDismiss={() => {}} />,
    );
    expect(screen.getByText("Failed to send")).toBeTruthy();
  });

  it("auto-dismisses after timeout", () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(
      <Toast message="Auto dismiss" type="success" onDismiss={onDismiss} />,
    );
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(onDismiss).toHaveBeenCalled();
    vi.useRealTimers();
  });
});

// ── StatusBadge ─────────────────────────────────────────────────────────

describe("StatusBadge", () => {
  it("renders the status text", () => {
    render(<StatusBadge status="Verified" />);
    expect(screen.getByText("Verified")).toBeTruthy();
  });

  it("applies success variant styling", () => {
    const { container } = render(
      <StatusBadge status="Delivered" variant="success" />,
    );
    const badge = container.firstElementChild;
    expect(badge?.className).toContain("text-green");
  });

  it("applies error variant styling", () => {
    const { container } = render(
      <StatusBadge status="Bounced" variant="error" />,
    );
    const badge = container.firstElementChild;
    expect(badge?.className).toContain("text-red");
  });

  it("applies warning variant styling", () => {
    const { container } = render(
      <StatusBadge status="Pending" variant="warning" />,
    );
    const badge = container.firstElementChild;
    expect(badge?.className).toContain("text-yellow");
  });

  it("applies default variant when not specified", () => {
    const { container } = render(<StatusBadge status="Unknown" />);
    const badge = container.firstElementChild;
    expect(badge?.className).toContain("text-[#A1A4A5]");
  });
});

// ── CopyToClipboard ─────────────────────────────────────────────────────

describe("CopyToClipboard", () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it("renders the value text", () => {
    render(<CopyToClipboard value="os_abc123" />);
    expect(screen.getByText("os_abc123")).toBeTruthy();
  });

  it("copies value to clipboard on click", async () => {
    render(<CopyToClipboard value="os_abc123" />);
    const button = screen.getByRole("button");
    await act(async () => {
      fireEvent.click(button);
    });
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("os_abc123");
  });

  it("shows confirmation state after copy", async () => {
    vi.useFakeTimers();
    render(<CopyToClipboard value="os_abc123" />);
    const button = screen.getByRole("button");
    await act(async () => {
      fireEvent.click(button);
    });
    // Should show a checkmark or "Copied" state
    expect(screen.getByLabelText("Copied")).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    // Should revert back
    expect(screen.queryByLabelText("Copied")).toBeNull();
    vi.useRealTimers();
  });
});

// ── Tabs ────────────────────────────────────────────────────────────────

describe("Tabs", () => {
  const tabs = [
    { value: "contacts", label: "Contacts" },
    { value: "properties", label: "Properties" },
    { value: "segments", label: "Segments" },
    { value: "topics", label: "Topics" },
  ];

  it("renders all tab labels", () => {
    render(<Tabs tabs={tabs} value="contacts" onChange={() => {}} />);
    for (const tab of tabs) {
      expect(screen.getByText(tab.label)).toBeTruthy();
    }
  });

  it("marks the active tab", () => {
    render(<Tabs tabs={tabs} value="contacts" onChange={() => {}} />);
    const activeTab = screen.getByText("Contacts");
    expect(activeTab.getAttribute("data-state")).toBe("active");
  });

  it("calls onChange when clicking a tab", () => {
    const onChange = vi.fn();
    render(<Tabs tabs={tabs} value="contacts" onChange={onChange} />);
    fireEvent.click(screen.getByText("Properties"));
    expect(onChange).toHaveBeenCalledWith("properties");
  });

  it("marks non-active tabs as inactive", () => {
    render(<Tabs tabs={tabs} value="contacts" onChange={() => {}} />);
    const inactiveTab = screen.getByText("Properties");
    expect(inactiveTab.getAttribute("data-state")).toBe("inactive");
  });
});

// ── Toggle ──────────────────────────────────────────────────────────────

describe("Toggle", () => {
  it("renders with label", () => {
    render(
      <Toggle label="Enable tracking" checked={false} onChange={() => {}} />,
    );
    expect(screen.getByText("Enable tracking")).toBeTruthy();
  });

  it("reflects checked state", () => {
    const { container } = render(
      <Toggle label="Test" checked={true} onChange={() => {}} />,
    );
    const switchEl = container.querySelector("[data-state='checked']");
    expect(switchEl).toBeTruthy();
  });

  it("calls onChange when toggled", () => {
    const onChange = vi.fn();
    render(<Toggle label="Test" checked={false} onChange={onChange} />);
    const switchEl = screen.getByRole("switch");
    fireEvent.click(switchEl);
    expect(onChange).toHaveBeenCalledWith(true);
  });
});

// ── EmptyState ──────────────────────────────────────────────────────────

describe("EmptyState", () => {
  it("renders title and description", () => {
    render(
      <EmptyState
        title="No emails yet"
        description="Send your first email to get started."
      />,
    );
    expect(screen.getByText("No emails yet")).toBeTruthy();
    expect(
      screen.getByText("Send your first email to get started."),
    ).toBeTruthy();
  });

  it("renders action button when provided", () => {
    const onAction = vi.fn();
    render(
      <EmptyState
        title="No domains"
        description="Add a domain to start sending."
        actionLabel="Add domain"
        onAction={onAction}
      />,
    );
    const button = screen.getByText("Add domain");
    fireEvent.click(button);
    expect(onAction).toHaveBeenCalled();
  });
});
