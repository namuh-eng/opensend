// ABOUTME: Unit tests for the Settings Usage tab — quota dashboard with Transactional, Marketing, and Team sections

import { UsageTab } from "@/components/settings-usage";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

afterEach(cleanup);

const defaultUsage = {
  plan: { name: "Free", slug: "free" },
  transactional: {
    monthlyUsed: 3,
    monthlyLimit: 3000,
    dailyUsed: 0,
    dailyLimit: 100,
  },
  marketing: {
    contactsUsed: 1,
    contactsLimit: 1000,
    segmentsUsed: 1,
    segmentsLimit: 3,
    broadcastsUsed: 0,
    broadcastsLimit: "Unlimited" as const,
  },
  team: {
    domainsUsed: 1,
    domainsLimit: 3,
    rateLimit: 2,
  },
};

describe("UsageTab", () => {
  it("renders the Transactional section with plan badge", () => {
    render(<UsageTab usage={defaultUsage} />);
    expect(screen.getByText("Transactional")).toBeDefined();
    expect(screen.getAllByText("Free").length).toBeGreaterThanOrEqual(1);
  });

  it("displays transactional monthly and daily limits", () => {
    render(<UsageTab usage={defaultUsage} />);
    expect(screen.getByText("Monthly limit")).toBeDefined();
    expect(screen.getByText("3 / 3,000")).toBeDefined();
    expect(screen.getByText("Daily limit")).toBeDefined();
    expect(screen.getByText("0 / 100")).toBeDefined();
  });

  it("renders the Marketing section with contacts, segments, broadcasts", () => {
    render(<UsageTab usage={defaultUsage} />);
    expect(screen.getByText("Marketing")).toBeDefined();
    expect(screen.getByText("Contacts limit")).toBeDefined();
    expect(screen.getByText("1 / 1,000")).toBeDefined();
    expect(screen.getByText("Segments limit")).toBeDefined();
    expect(screen.getByText("Broadcasts limit")).toBeDefined();
    expect(screen.getByText("Unlimited")).toBeDefined();
    // "1 / 3" appears for both segments and domains — verify both exist
    expect(screen.getAllByText("1 / 3").length).toBe(2);
  });

  it("renders the Team section with domains and rate limit", () => {
    render(<UsageTab usage={defaultUsage} />);
    expect(screen.getByText("Team")).toBeDefined();
    expect(screen.getByText("Domains limit")).toBeDefined();
    // "1 / 3" verified in marketing test as appearing twice (segments + domains)
    expect(screen.getByText("Rate limit")).toBeDefined();
    expect(screen.getByText("2 / sec")).toBeDefined();
  });

  it("renders transactional description text", () => {
    render(<UsageTab usage={defaultUsage} />);
    expect(
      screen.getByText(/Integrate email into your app using/),
    ).toBeDefined();
  });

  it("renders marketing description text", () => {
    render(<UsageTab usage={defaultUsage} />);
    expect(screen.getByText(/Design and send marketing emails/)).toBeDefined();
  });

  it("links upgrade affordances to the authenticated billing plans page when billing is enabled", () => {
    render(<UsageTab usage={defaultUsage} billingEnabled={true} />);

    const upgradeLinks = screen.getAllByRole("link", { name: "Upgrade" });
    expect(upgradeLinks).toHaveLength(3);
    for (const link of upgradeLinks) {
      expect(link.getAttribute("href")).toBe("/settings/billing/plans");
      expect(link.getAttribute("href")).not.toBe("/auth");
    }
  });

  it("renders disabled explanatory upgrade affordances when billing is disabled", () => {
    render(<UsageTab usage={defaultUsage} billingEnabled={false} />);

    expect(screen.queryByRole("link", { name: "Upgrade" })).toBeNull();
    const unavailableButtons = screen.getAllByRole("button", {
      name: "Upgrade unavailable",
    });
    expect(unavailableButtons).toHaveLength(3);
    for (const button of unavailableButtons) {
      expect(button).toHaveProperty("disabled", true);
    }
    expect(
      screen.getAllByText(/Billing is disabled for this installation/),
    ).toHaveLength(3);
  });

  it("renders circular progress indicators for quota rows", () => {
    const { container } = render(<UsageTab usage={defaultUsage} />);
    const svgs = container.querySelectorAll("svg.quota-indicator");
    // At least one per quota row (monthly, daily, contacts, segments, domains)
    expect(svgs.length).toBeGreaterThanOrEqual(5);
  });

  it("shows warning state when quota is at limit", () => {
    const atLimitUsage = {
      ...defaultUsage,
      transactional: {
        ...defaultUsage.transactional,
        monthlyUsed: 3000,
        monthlyLimit: 3000,
      },
    };
    const { container } = render(<UsageTab usage={atLimitUsage} />);
    const warningIndicators = container.querySelectorAll(
      "svg.quota-indicator.at-limit",
    );
    expect(warningIndicators.length).toBeGreaterThanOrEqual(1);
  });

  it("explains over-limit team domain usage with the active plan name", () => {
    const overLimitUsage = {
      ...defaultUsage,
      team: {
        ...defaultUsage.team,
        domainsUsed: 4,
        domainsLimit: 3,
      },
    };

    render(<UsageTab usage={overLimitUsage} billingEnabled={true} />);

    expect(screen.getByRole("alert").textContent).toContain(
      "You are 1 domain over the Free plan domain limit.",
    );
    expect(screen.getByText("4 / 3")).toBeDefined();
  });

  it("formats numbers with commas", () => {
    render(<UsageTab usage={defaultUsage} />);
    expect(screen.getByText("3 / 3,000")).toBeDefined();
    expect(screen.getByText("1 / 1,000")).toBeDefined();
  });
});
