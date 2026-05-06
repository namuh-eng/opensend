import { EmailDetail } from "@/components/email-detail";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}));

const mockEmail = {
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
    { type: "sent", timestamp: "2026-03-28T16:14:00.000Z" },
    { type: "delivered", timestamp: "2026-03-28T16:14:02.000Z" },
  ],
};

afterEach(cleanup);

describe("EmailDetail", () => {
  it("renders email metadata fields (From, Subject, To, Id)", () => {
    render(<EmailDetail email={mockEmail} />);

    expect(screen.getByText("FROM")).toBeTruthy();
    expect(screen.getByText("test@updates.foreverbrowsing.com")).toBeTruthy();

    expect(screen.getByText("SUBJECT")).toBeTruthy();
    expect(screen.getByText("Test email #3 - Invoice")).toBeTruthy();

    expect(screen.getByText("TO")).toBeTruthy();
    // The email appears in both the heading and TO field
    const toElements = screen.getAllByText("jaeyunha0317@gmail.com");
    expect(toElements.length).toBeGreaterThanOrEqual(2);

    expect(screen.getByText("ID")).toBeTruthy();
  });

  it("renders event timeline in chronological order", () => {
    render(<EmailDetail email={mockEmail} />);

    expect(screen.getByText("EMAIL EVENTS")).toBeTruthy();

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

  it("renders email ID with copy button", () => {
    render(<EmailDetail email={mockEmail} />);

    const copyButton = screen.getByLabelText("Copy to clipboard");
    expect(copyButton).toBeTruthy();
  });

  it("renders page header with Email label and recipient", () => {
    render(<EmailDetail email={mockEmail} />);

    expect(screen.getByText("Email")).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "jaeyunha0317@gmail.com" }),
    ).toBeTruthy();
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
    expect(
      screen.getByRole("link", { name: /View all logs/i }).getAttribute("href"),
    ).toBe(`/logs?q=${mockEmail.id}`);
  });

  it("renders envelope icon in header", () => {
    render(<EmailDetail email={mockEmail} />);

    expect(screen.getByTestId("email-envelope-icon")).toBeTruthy();
  });
});
