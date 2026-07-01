import {
  PricingGrid,
  type PricingPlan,
} from "@/components/billing/pricing-grid";
import {
  PRICING_TIERS,
  getPricingCardsForSelection,
} from "@/components/pricing/pricing-catalog";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const plans: PricingPlan[] = [
  {
    id: "plan_lite",
    slug: "cloud_lite_15k_monthly",
    name: "Lite",
    monthlyPriceCents: 1000,
    monthlyEmailQuota: 15000,
    maxDomains: 3,
    maxApiKeys: 5,
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
    render(<PricingGrid plans={plans} currentPlanId="plan_lite" />);

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

  it("does not expose a free pricing tier or checkout branch", () => {
    expect(PRICING_TIERS.map((plan) => plan.family)).not.toContain("free");
    expect(PRICING_TIERS.map((plan) => plan.slug)).not.toContain("free");
    expect(PRICING_TIERS.map((plan) => plan.checkoutKind)).not.toContain(
      "free",
    );
    expect(
      getPricingCardsForSelection("cloud_lite_15k_monthly")[0],
    ).toMatchObject({
      family: "lite",
      slug: "cloud_lite_15k_monthly",
      checkoutKind: "stripe",
    });
  });

  it("renders dashboard plans with Lite as the entry package", () => {
    render(<PricingGrid plans={plans} currentPlanId="plan_lite" />);

    expect(screen.getByTestId("pricing-tier-selector").textContent).toContain(
      "Choose one pooled API + broadcast package",
    );
    expect(screen.getByTestId("pricing-tier-selector").textContent).toContain(
      "Lite",
    );
    expect(screen.getByTestId("pricing-tier-selector").textContent).toContain(
      "15k",
    );
    expect(screen.queryByTestId("pricing-card-free")).toBeNull();
    expect(screen.getByTestId("pricing-card-lite").textContent).toContain(
      "For indie makers shipping their first product email.",
    );
    expect(screen.getByTestId("pricing-card-lite").textContent).toContain(
      "15,000 API + broadcast emails/mo",
    );
    expect(screen.getByTestId("pricing-card-lite").textContent).toContain(
      "Current plan",
    );
    expect(screen.getByTestId("pricing-card-starter").textContent).toContain(
      "Change to Starter ($19 / mo)",
    );
  });
});
