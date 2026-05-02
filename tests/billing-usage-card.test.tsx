import { UsageCard } from "@/components/billing/usage-card";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

afterEach(cleanup);

describe("<UsageCard />", () => {
  it("renders all three quota rows with formatted ratios", () => {
    render(
      <UsageCard
        data={{
          emails: { used: 250, limit: 1000 },
          domains: { used: 0, limit: 1 },
          apiKeys: { used: 1, limit: 3 },
          periodStart: "2026-05-01T00:00:00.000Z",
          periodEnd: "2026-05-31T00:00:00.000Z",
          hasUsagePeriod: true,
        }}
      />,
    );

    expect(screen.getByText("Emails sent")).toBeDefined();
    expect(screen.getByText("Domains")).toBeDefined();
    expect(screen.getByText("API keys")).toBeDefined();
    expect(screen.getByText(/250 \/ 1,000/)).toBeDefined();
    expect(screen.getByTestId("usage-emails-percent").textContent).toBe("25%");
  });

  it("colours the bar amber when usage crosses the warn threshold", () => {
    render(
      <UsageCard
        data={{
          emails: { used: 850, limit: 1000 },
          domains: { used: 0, limit: 1 },
          apiKeys: { used: 0, limit: 3 },
          periodStart: null,
          periodEnd: null,
          hasUsagePeriod: true,
        }}
      />,
    );

    const emailsRow = screen.getByTestId("usage-emails");
    const bar = emailsRow.querySelector('[data-threshold="warn"]');
    expect(bar).not.toBeNull();
  });

  it("colours the bar red when usage hits the limit", () => {
    render(
      <UsageCard
        data={{
          emails: { used: 1500, limit: 1000 },
          domains: { used: 0, limit: 1 },
          apiKeys: { used: 0, limit: 3 },
          periodStart: null,
          periodEnd: null,
          hasUsagePeriod: true,
        }}
      />,
    );

    const emailsRow = screen.getByTestId("usage-emails");
    const bar = emailsRow.querySelector('[data-threshold="critical"]');
    expect(bar).not.toBeNull();
  });

  it("renders an unknown email usage state when no usage period exists", () => {
    render(
      <UsageCard
        data={{
          emails: { used: null, limit: 1000 },
          domains: { used: 0, limit: 1 },
          apiKeys: { used: 0, limit: 3 },
          periodStart: null,
          periodEnd: null,
          hasUsagePeriod: false,
        }}
      />,
    );

    expect(screen.getByTestId("usage-emails-unknown")).toBeDefined();
    expect(screen.getByText("Unknown / 1,000")).toBeDefined();
    expect(screen.getByText(/has not been reported/)).toBeDefined();
  });
});
