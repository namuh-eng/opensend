import {
  EmailsSendingDataTable,
  formatRelativeTime,
  getStatusVariant,
} from "@/components/emails-sending-data-table";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(cleanup);

const mockEmails = [
  {
    id: "email-1",
    to: ["jaeyunha0317@gmail.com"],
    lastEvent: "delivered" as const,
    subject: "Test email #3 - Invoice",
    createdAt: new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "email-2",
    to: ["user@example.com"],
    lastEvent: "bounced" as const,
    subject: "Test email #2 - Welcome",
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "email-3",
    to: ["another@test.com"],
    lastEvent: "sent" as const,
    subject: "Test email #1 from Ralph",
    createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
  },
];

describe("EmailsSendingDataTable", () => {
  it("renders email rows with correct columns", () => {
    render(<EmailsSendingDataTable emails={mockEmails} />);

    // Check all column headers
    expect(screen.getByText("To")).toBeTruthy();
    expect(screen.getByText("Status")).toBeTruthy();
    expect(screen.getByText("Subject")).toBeTruthy();
    expect(screen.getAllByText("Sent").length).toBeGreaterThanOrEqual(1);

    // Check row data
    expect(screen.getByText("jaeyunha0317@gmail.com")).toBeTruthy();
    expect(screen.getByText("user@example.com")).toBeTruthy();
    expect(screen.getByText("another@test.com")).toBeTruthy();

    expect(screen.getByText("Test email #3 - Invoice")).toBeTruthy();
    expect(screen.getByText("Test email #2 - Welcome")).toBeTruthy();
    expect(screen.getByText("Test email #1 from Ralph")).toBeTruthy();
  });

  it("renders status badges with correct text", () => {
    render(<EmailsSendingDataTable emails={mockEmails} />);

    expect(screen.getByText("Delivered")).toBeTruthy();
    expect(screen.getByText("Bounced")).toBeTruthy();
    // "Sent" appears as both column header and status badge
    const sentElements = screen.getAllByText("Sent");
    expect(sentElements.length).toBe(2); // header + badge
  });

  it("renders email links pointing to detail page", () => {
    render(<EmailsSendingDataTable emails={mockEmails} />);

    const link = screen.getByText("jaeyunha0317@gmail.com");
    expect(link.closest("a")).toBeTruthy();
    expect(link.closest("a")?.getAttribute("href")).toBe("/emails/email-1");
  });

  it("renders avatar circles for each email", () => {
    render(<EmailsSendingDataTable emails={mockEmails} />);

    // Each row should have an avatar (3 total)
    const avatars = document.querySelectorAll('[data-testid="email-avatar"]');
    expect(avatars.length).toBe(3);
  });

  it("renders three-dot More actions button on each row", () => {
    render(<EmailsSendingDataTable emails={mockEmails} />);

    const actionButtons = screen.getAllByLabelText("More actions");
    expect(actionButtons.length).toBe(3);
  });

  it("shows first-run empty state with visible docs CTA when no emails exist", () => {
    render(<EmailsSendingDataTable emails={[]} emptyState="first-run" />);

    expect(
      screen.getByRole("heading", { name: "No sent emails yet" }),
    ).toBeTruthy();
    expect(
      screen.getByText(
        "Start sending emails to see insights and previews for every message.",
      ),
    ).toBeTruthy();

    const docsLink = screen.getByRole("link", { name: "Go to docs" });
    expect(docsLink).toBeTruthy();
    expect(docsLink.getAttribute("href")).toBe("/docs");
  });

  it("shows filter-specific empty state when existing emails are filtered out", () => {
    render(<EmailsSendingDataTable emails={[]} emptyState="filtered" />);

    expect(screen.getByText("No emails match your filters")).toBeTruthy();
    expect(screen.queryByText("No sent emails yet")).toBeNull();
    expect(screen.queryByRole("link", { name: "Go to docs" })).toBeNull();
  });

  it("formats relative time correctly", () => {
    // 20 hours ago
    const twentyHoursAgo = new Date(
      Date.now() - 20 * 60 * 60 * 1000,
    ).toISOString();
    expect(formatRelativeTime(twentyHoursAgo)).toBe("about 20 hours ago");

    // 5 minutes ago
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    expect(formatRelativeTime(fiveMinAgo)).toBe("about 5 minutes ago");

    // 2 days ago
    const twoDaysAgo = new Date(
      Date.now() - 2 * 24 * 60 * 60 * 1000,
    ).toISOString();
    expect(formatRelativeTime(twoDaysAgo)).toBe("about 2 days ago");
  });

  it("uses sentAt for the Sent column when the worker has sent the message", () => {
    const createdAt = new Date("2026-04-28T00:00:00Z").toISOString();
    const sentAt = new Date("2026-04-28T00:00:30Z").toISOString();

    render(
      <EmailsSendingDataTable
        emails={[
          {
            id: "email-sent-at",
            to: ["sent-at@example.com"],
            lastEvent: "sent",
            subject: "Sent timestamp",
            createdAt,
            sentAt,
          },
        ]}
      />,
    );

    expect(screen.getByTitle(new Date(sentAt).toLocaleString())).toBeTruthy();
  });

  it("maps status to correct variant", () => {
    expect(getStatusVariant("delivered")).toBe("success");
    expect(getStatusVariant("sent")).toBe("success");
    expect(getStatusVariant("bounced")).toBe("error");
    expect(getStatusVariant("failed")).toBe("error");
    expect(getStatusVariant("opened")).toBe("info");
    expect(getStatusVariant("clicked")).toBe("info");
    expect(getStatusVariant("delivery_delayed")).toBe("warning");
    expect(getStatusVariant("complained")).toBe("warning");
    expect(getStatusVariant("processing")).toBe("warning");
    expect(getStatusVariant("queued")).toBe("default");
    expect(getStatusVariant("scheduled")).toBe("default");
    expect(getStatusVariant("canceled")).toBe("default");
    expect(getStatusVariant("suppressed")).toBe("default");
  });
});
