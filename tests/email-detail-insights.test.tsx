import { EmailDetail, type EmailDetailData } from "@/components/email-detail";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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
      summary: "Accepted by provider",
      details: {},
    },
    {
      id: "event-delivered",
      type: "delivered",
      timestamp: "2026-03-28T16:14:02.000Z",
      summary: "Delivered",
      details: {},
    },
  ],
};

afterEach(cleanup);

describe("EmailDetail - Content Tabs with Insights", () => {
  it("renders 4 content tabs (Preview, Plain Text, HTML, Insights)", () => {
    render(<EmailDetail email={mockEmail} />);

    expect(screen.getByText("Preview")).toBeTruthy();
    expect(screen.getByText("Plain Text")).toBeTruthy();
    expect(screen.getByText("HTML")).toBeTruthy();
    // Insights tab has a count badge, so check for the tab button
    const insightsTab = screen.getByRole("button", { name: /Insights/i });
    expect(insightsTab).toBeTruthy();
  });

  it("shows Preview tab active by default", () => {
    render(<EmailDetail email={mockEmail} />);

    const previewTab = screen.getByText("Preview");
    expect(previewTab.getAttribute("data-state")).toBe("active");
    expect(screen.getByTestId("email-preview")).toBeTruthy();
  });

  it("switches to Insights tab and shows deliverability report", () => {
    render(<EmailDetail email={mockEmail} />);

    const insightsTab = screen.getByRole("button", { name: /Insights/i });
    fireEvent.click(insightsTab);

    expect(insightsTab.getAttribute("data-state")).toBe("active");
    expect(screen.getByText("NEEDS ATTENTION")).toBeTruthy();
    expect(screen.getByText("DOING GREAT")).toBeTruthy();
  });

  it("insights categorized into needs_attention and doing_great groups", () => {
    render(<EmailDetail email={mockEmail} />);

    const insightsTab = screen.getByRole("button", { name: /Insights/i });
    fireEvent.click(insightsTab);

    const needsAttention = screen.getByTestId("needs-attention-section");
    const doingGreat = screen.getByTestId("doing-great-section");

    // needs_attention section should contain DMARC check
    expect(needsAttention.textContent).toContain("Include valid DMARC record");

    // doing_great section should contain tracking checks
    expect(doingGreat.textContent).toContain("Disable click tracking");
    expect(doingGreat.textContent).toContain("Disable open tracking");
  });

  it("expands insight accordion item on click", () => {
    render(<EmailDetail email={mockEmail} />);

    const insightsTab = screen.getByRole("button", { name: /Insights/i });
    fireEvent.click(insightsTab);

    const dmarcItem = screen.getByText("Include valid DMARC record");
    fireEvent.click(dmarcItem);

    // After expanding, the detail text should be visible
    expect(screen.getByTestId("insight-detail-dmarc")).toBeTruthy();
  });

  it("shows Insights badge count for needs_attention items", () => {
    render(<EmailDetail email={mockEmail} />);

    // The Insights tab should show a count badge for needs_attention items
    const insightsTab = screen.getByRole("button", { name: /Insights/i });
    // Badge shows count of needs_attention items
    expect(insightsTab.textContent).toContain("1");
  });

  it("shows copy button next to content tabs", () => {
    render(<EmailDetail email={mockEmail} />);

    const copyBtn = screen.getByTestId("tab-copy-button");
    expect(copyBtn).toBeTruthy();
  });

  it("switches between all 4 tabs correctly", () => {
    render(<EmailDetail email={mockEmail} />);

    // Click Plain Text
    fireEvent.click(screen.getByText("Plain Text"));
    expect(screen.getByTestId("email-plaintext")).toBeTruthy();

    // Click HTML
    fireEvent.click(screen.getByText("HTML"));
    expect(screen.getByTestId("email-html")).toBeTruthy();

    // Click Insights
    fireEvent.click(screen.getByRole("button", { name: /Insights/i }));
    expect(screen.getByText("NEEDS ATTENTION")).toBeTruthy();

    // Click Preview
    fireEvent.click(screen.getByText("Preview"));
    expect(screen.getByTestId("email-preview")).toBeTruthy();
  });
});
