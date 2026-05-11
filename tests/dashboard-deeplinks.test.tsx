import { render, screen } from "@testing-library/react";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetServerSession = vi.hoisted(() => vi.fn());
const mockIsBillingEnabled = vi.hoisted(() => vi.fn());
const mockLoadBillingSummary = vi.hoisted(() => vi.fn());
const mockRedirect = vi.hoisted(() =>
  vi.fn((path: string): never => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  }),
);

vi.mock("@/lib/api-auth", () => ({
  getServerSession: mockGetServerSession,
}));

vi.mock("@/lib/billing", () => ({
  isBillingEnabled: mockIsBillingEnabled,
}));

vi.mock("@/lib/billing/summary", () => ({
  loadBillingSummary: mockLoadBillingSummary,
}));

vi.mock("next/navigation", () => ({
  redirect: mockRedirect,
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

vi.mock("@/components/billing/billing-view", () => ({
  BillingView: ({ initial }: { initial: unknown }) => (
    <div data-testid="billing-view">{JSON.stringify(initial)}</div>
  ),
}));

describe("dashboard production deep links", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue({ user: { id: "user-1" } });
    mockIsBillingEnabled.mockReturnValue(false);
  });

  it("canonically redirects /emails/sending to the Sending tab page", async () => {
    const Page = (await import("@/app/(dashboard)/emails/sending/page"))
      .default;

    expect(() => Page()).toThrow("NEXT_REDIRECT:/emails");
    expect(mockRedirect).toHaveBeenCalledWith("/emails");
  });

  it("canonically redirects /audience/contacts to the Contacts tab page", async () => {
    const Page = (await import("@/app/(dashboard)/audience/contacts/page"))
      .default;

    expect(() => Page()).toThrow("NEXT_REDIRECT:/audience");
    expect(mockRedirect).toHaveBeenCalledWith("/audience");
  });

  it("renders an unavailable state for the topics unsubscribe editor deep link", async () => {
    const Page = (
      await import(
        "@/app/(dashboard)/audience/topics/unsubscribe-page/edit/page"
      )
    ).default;

    render(Page() as React.ReactElement);

    expect(
      screen.getByRole("heading", {
        name: "Unsubscribe page editor unavailable",
      }),
    ).toBeDefined();
    expect(
      screen.getByText(
        "Opensend still serves the default unsubscribe page for public topics, but dashboard customization is not available yet.",
      ),
    ).toBeDefined();
    expect(
      screen.getByRole("link", { name: "Back to topics" }).getAttribute("href"),
    ).toBe("/audience/topics");
  });

  it("renders a billing unavailable state instead of raw-404 when billing is disabled", async () => {
    const Page = (await import("@/app/(dashboard)/settings/billing/page"))
      .default;

    const result = await Page();
    render(result as React.ReactElement);

    expect(screen.getByRole("heading", { name: "Billing" })).toBeDefined();
    expect(
      screen.getByText("Billing is not enabled for this Opensend deployment."),
    ).toBeDefined();
    expect(
      screen
        .getByRole("link", { name: "Back to settings" })
        .getAttribute("href"),
    ).toBe("/settings");
    expect(mockLoadBillingSummary).not.toHaveBeenCalled();
  });

  it("preserves billing dashboard auth before rendering the disabled state", async () => {
    mockGetServerSession.mockResolvedValueOnce(null);
    const Page = (await import("@/app/(dashboard)/settings/billing/page"))
      .default;

    await expect(Page()).rejects.toThrow("NEXT_REDIRECT:/auth");
    expect(mockRedirect).toHaveBeenCalledWith("/auth");
    expect(mockIsBillingEnabled).not.toHaveBeenCalled();
    expect(mockLoadBillingSummary).not.toHaveBeenCalled();
  });
});
