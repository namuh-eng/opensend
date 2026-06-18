import { render, screen } from "@testing-library/react";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetServerSession = vi.hoisted(() => vi.fn());
const mockIsBillingEnabled = vi.hoisted(() => vi.fn());
const mockListPublicPlans = vi.hoisted(() => vi.fn());
const mockLoadBillingSummary = vi.hoisted(() => vi.fn());
const mockPricingGrid = vi.hoisted(() =>
  vi.fn(
    ({
      plans,
      currentPlanId,
    }: {
      plans: Array<{ id: string; slug: string; name: string }>;
      currentPlanId: string | null;
    }) => (
      <div
        data-current-plan-id={currentPlanId ?? ""}
        data-testid="pricing-grid"
      >
        {plans.map((plan) => (
          <span key={plan.id}>{plan.name}</span>
        ))}
      </div>
    ),
  ),
);
const mockRedirect = vi.hoisted(() =>
  vi.fn((path: string): never => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  }),
);
const mockNotFound = vi.hoisted(() =>
  vi.fn((): never => {
    throw new Error("NEXT_NOT_FOUND");
  }),
);

vi.mock("@/lib/api-auth", () => ({
  getServerSession: mockGetServerSession,
}));

vi.mock("@/lib/billing", () => ({
  isBillingEnabled: mockIsBillingEnabled,
}));

vi.mock("@/lib/billing/summary", () => ({
  listPublicPlans: mockListPublicPlans,
  loadBillingSummary: mockLoadBillingSummary,
}));

vi.mock("@/components/billing/pricing-grid", () => ({
  PricingGrid: mockPricingGrid,
}));

vi.mock("next/navigation", () => ({
  redirect: mockRedirect,
  notFound: mockNotFound,
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

async function importPlansPage() {
  return (await import("@/app/(dashboard)/settings/billing/plans/page"))
    .default;
}

describe("authenticated billing plans page", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockIsBillingEnabled.mockReturnValue(true);
    mockGetServerSession.mockResolvedValue({ user: { id: "user_123" } });
    mockListPublicPlans.mockResolvedValue([
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
        slug: "starter",
        name: "Starter",
        monthlyPriceCents: 1900,
        monthlyEmailQuota: 55000,
        maxDomains: 10,
        maxApiKeys: 10,
      },
    ]);
    mockLoadBillingSummary.mockResolvedValue({ plan: { id: "plan_free" } });
  });

  it("redirects logged-out users to auth before listing checkout-capable plans", async () => {
    mockGetServerSession.mockResolvedValueOnce(null);
    const Page = await importPlansPage();

    await expect(Page()).rejects.toThrow("NEXT_REDIRECT:/auth");
    expect(mockRedirect).toHaveBeenCalledWith("/auth");
    expect(mockListPublicPlans).not.toHaveBeenCalled();
  });

  it("renders signed-in users on the dashboard plan picker rather than public pricing", async () => {
    const Page = await importPlansPage();

    const result = await Page();
    render(result as React.ReactElement);

    expect(screen.getByRole("dialog", { name: "Plans" })).toBeDefined();
    expect(
      screen.getByRole("link", { name: "Close plans" }).getAttribute("href"),
    ).toBe("/settings/billing");
    expect(screen.getByRole("heading", { name: "Plans" })).toBeDefined();
    expect(
      screen.getByTestId("pricing-grid").getAttribute("data-current-plan-id"),
    ).toBe("plan_free");
    expect(mockPricingGrid).toHaveBeenCalledWith(
      expect.objectContaining({
        plans: [
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
            slug: "starter",
            name: "Starter",
            monthlyPriceCents: 1900,
            monthlyEmailQuota: 55000,
            maxDomains: 10,
            maxApiKeys: 10,
          },
        ],
        currentPlanId: "plan_free",
      }),
      undefined,
    );
    expect(screen.queryByRole("link", { name: /sign in/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /get started/i })).toBeNull();
  });

  it("keeps the billing-disabled route unavailable for self-host deployments", async () => {
    mockIsBillingEnabled.mockReturnValueOnce(false);
    const Page = await importPlansPage();

    await expect(Page()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mockNotFound).toHaveBeenCalledTimes(1);
    expect(mockGetServerSession).not.toHaveBeenCalled();
    expect(mockListPublicPlans).not.toHaveBeenCalled();
  });
});
