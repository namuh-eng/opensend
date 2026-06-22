import {
  PricingGrid,
  type PricingPlan,
} from "@/components/billing/pricing-grid";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const plans: PricingPlan[] = [
  {
    id: "plan_free",
    slug: "free",
    name: "Free",
    monthlyPriceCents: 0,
    monthlyEmailQuota: 500,
    maxDomains: 1,
    maxApiKeys: 2,
  },
  {
    id: "plan_starter",
    slug: "cloud_starter_55k_monthly",
    name: "Starter",
    monthlyPriceCents: 1900,
    monthlyEmailQuota: 55000,
    maxDomains: 10,
    maxApiKeys: 10,
  },
];

afterEach(cleanup);

describe("PricingGrid", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ message: "Stripe unavailable in test" }),
    });
  });

  it("posts selected signed-in dashboard upgrades to checkout instead of linking to public auth", async () => {
    const user = userEvent.setup();
    render(<PricingGrid plans={plans} currentPlanId="plan_free" />);

    expect(screen.queryByRole("link", { name: /upgrade/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /auth/i })).toBeNull();

    await user.click(screen.getByTestId("pricing-card-starter-upgrade"));

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    expect(mockFetch).toHaveBeenCalledWith("/api/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan_id: "plan_starter" }),
    });
  });

  it("renders dashboard plans with the OpenSend package picker treatment", () => {
    render(<PricingGrid plans={plans} currentPlanId="plan_free" />);

    expect(screen.getByTestId("pricing-tier-selector").textContent).toContain(
      "Choose one pooled API + broadcast package",
    );
    expect(screen.getByTestId("pricing-tier-selector").textContent).toContain(
      "Starter",
    );
    expect(screen.getByTestId("pricing-tier-selector").textContent).toContain(
      "51k",
    );
    expect(screen.getByTestId("pricing-card-free").textContent).toContain(
      "For tinkering and side projects.",
    );
    expect(screen.getByTestId("pricing-card-free").textContent).toContain(
      "500 API + broadcast emails/mo",
    );
    expect(screen.getByTestId("pricing-card-starter").textContent).toContain(
      "Change to Starter ($19 / mo)",
    );
  });
});
