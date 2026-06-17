import { EmailDetail, type EmailDetailData } from "@/components/email-detail";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}));

const mockEmail: EmailDetailData = {
  id: "88269538-8271-43a8-9ee3-1300abcd1234",
  from: "test@updates.foreverbrowsing.com",
  to: ["jaeyunha0317@gmail.com"],
  subject: "Test email #3 - Invoice",
  html: "<h1>Invoice #1234</h1><p>Amount: $49.99</p>",
  text: "Invoice #1234\nAmount: $49.99",
  createdAt: "2026-03-28T16:14:00.000Z",
  scheduledAt: null,
  tags: [],
  headers: {},
  events: [
    {
      id: "event-sent",
      type: "sent",
      timestamp: "2026-03-28T16:14:00.000Z",
      summary: "Accepted by provider as ses-message-123",
      details: { message_id: "ses-message-123" },
    },
    {
      id: "event-delivered",
      type: "delivered",
      timestamp: "2026-03-28T16:14:02.000Z",
      summary: "Delivered to jaeyunha0317@gmail.com — 250 Ok",
      details: {
        recipients: ["jaeyunha0317@gmail.com"],
        smtp_response: "250 Ok",
      },
    },
  ],
};

afterEach(cleanup);

describe("EmailDetail", () => {
  it("renders email metadata fields (From, Subject, To, Id)", () => {
    render(<EmailDetail email={mockEmail} />);

    expect(screen.getByText("FROM")).toBeTruthy();
    expect(
      screen.getAllByText("test@updates.foreverbrowsing.com").length,
    ).toBeGreaterThanOrEqual(1);

    expect(screen.getByText("SUBJECT")).toBeTruthy();
    expect(
      screen.getAllByText("Test email #3 - Invoice").length,
    ).toBeGreaterThanOrEqual(1);

    expect(screen.getByText("TO")).toBeTruthy();
    // The email appears in both the heading and TO field
    const toElements = screen.getAllByText("jaeyunha0317@gmail.com");
    expect(toElements.length).toBeGreaterThanOrEqual(2);

    expect(screen.getByText("ID")).toBeTruthy();
  });

  it("renders event timeline in chronological order", () => {
    render(<EmailDetail email={mockEmail} />);

    expect(screen.getByText("MESSAGE TRACE")).toBeTruthy();

    const sentBadge = screen.getByText("Sent");
    const deliveredBadge = screen.getByText("Delivered");
    expect(sentBadge).toBeTruthy();
    expect(deliveredBadge).toBeTruthy();

    // Sent should appear before Delivered in DOM order
    const timeline = screen.getByTestId("event-timeline");
    const badges = timeline.querySelectorAll("[data-testid='event-badge']");
    expect(badges.length).toBe(2);
    expect(badges[0].textContent).toBe("Sent");
    expect(badges[1].textContent).toBe("Delivered");
  });

  it("renders event ids and sanitized payload-backed details", () => {
    render(<EmailDetail email={mockEmail} />);

    expect(screen.getByText("trace_id: event-delivered")).toBeTruthy();
    expect(
      screen.getByText("Delivered to jaeyunha0317@gmail.com — 250 Ok"),
    ).toBeTruthy();
    expect(screen.getByText("Smtp Response:")).toBeTruthy();
    expect(screen.getByText("250 Ok")).toBeTruthy();
  });

  it("renders email ID with copy buttons", () => {
    render(<EmailDetail email={mockEmail} />);

    const copyButtons = screen.getAllByLabelText("Copy to clipboard");
    expect(copyButtons.length).toBeGreaterThanOrEqual(1);
  });

  it("renders a detail header with subject and recipient routing", () => {
    render(<EmailDetail email={mockEmail} />);

    expect(screen.getByText("Email details")).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "Test email #3 - Invoice" }),
    ).toBeTruthy();
    expect(
      screen.getAllByText(/test@updates\.foreverbrowsing\.com/).length,
    ).toBeGreaterThanOrEqual(1);
    expect(
      screen.getAllByText("jaeyunha0317@gmail.com").length,
    ).toBeGreaterThanOrEqual(1);
  });

  it("renders content tabs (Preview, Plain Text, HTML, Insights)", () => {
    render(<EmailDetail email={mockEmail} />);

    expect(screen.getByText("Preview")).toBeTruthy();
    expect(screen.getByText("Plain Text")).toBeTruthy();
    expect(screen.getByText("HTML")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Insights/i })).toBeTruthy();
  });

  it("shows email preview content by default", () => {
    render(<EmailDetail email={mockEmail} />);

    // The preview tab should show rendered HTML content
    expect(screen.getByTestId("email-preview")).toBeTruthy();
  });

  it("falls back to plain text in Preview for text-only messages", () => {
    render(
      <EmailDetail email={{ ...mockEmail, html: "", text: "Only text" }} />,
    );

    expect(screen.getByTestId("email-preview")).toBeTruthy();
    expect(screen.getByText("Plain text email")).toBeTruthy();
    expect(screen.getByText("Only text")).toBeTruthy();
  });

  it("formats event timestamps", () => {
    render(<EmailDetail email={mockEmail} />);

    // Check timestamps are rendered with month and time format
    const timeline = screen.getByTestId("event-timeline");
    // formatEventTimestamp converts to local time, so just check the format pattern exists
    expect(timeline.textContent).toMatch(/Mar \d+, \d+:\d+ [AP]M/);
  });

  it("renders associated request logs and links to the logs explorer", () => {
    render(
      <EmailDetail
        email={{
          ...mockEmail,
          logs: [
            {
              id: "log-123",
              method: "POST",
              endpoint: "/api/emails",
              statusCode: 200,
              createdAt: "2026-05-06T00:00:00.000Z",
            },
          ],
        }}
      />,
    );

    expect(screen.getByText("ASSOCIATED LOGS")).toBeTruthy();
    expect(screen.getByText("/api/emails")).toBeTruthy();
    expect(screen.getByText("same email_id")).toBeTruthy();
    expect(screen.getByText("log_id: log-123")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: /View all logs/i }).getAttribute("href"),
    ).toBe(`/logs?q=${mockEmail.id}`);
  });

  it("renders envelope icon in header", () => {
    render(<EmailDetail email={mockEmail} />);

    expect(screen.getByTestId("email-envelope-icon")).toBeTruthy();
  });
});
