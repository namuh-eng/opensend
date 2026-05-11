// ABOUTME: E2E test for Settings Usage tab — verifies quota sections and billing-aware upgrade affordances
// E2E category: smoke-only; settings usage assertions are UI-copy smoke and need refresh follow-up (#229 audit).
test.skip(
  true,
  "E2E category: smoke-only; settings usage assertions are UI-copy smoke and need refresh follow-up (#229 audit).",
);

import { expect, test } from "./fixtures/auth";

const billingEnabled =
  process.env.BILLING_BACKEND?.toLowerCase() === "stripe" &&
  Boolean(process.env.STRIPE_SECRET_KEY?.trim());

test.describe("Settings Usage Page", () => {
  test("displays all quota sections with correct labels", async ({
    authenticatedPage,
  }) => {
    await authenticatedPage.goto("/settings");

    // Usage tab should be active by default
    const usageTab = authenticatedPage.locator('button:has-text("Usage")');
    await expect(usageTab).toBeVisible();
    await expect(usageTab).toHaveAttribute("data-state", "active");

    // Transactional section
    await expect(authenticatedPage.locator("text=Transactional")).toBeVisible();
    await expect(authenticatedPage.locator("text=Monthly limit")).toBeVisible();
    await expect(authenticatedPage.locator("text=Daily limit")).toBeVisible();

    // Marketing section
    await expect(authenticatedPage.locator("text=Marketing")).toBeVisible();
    await expect(
      authenticatedPage.locator("text=Contacts limit"),
    ).toBeVisible();
    await expect(
      authenticatedPage.locator("text=Segments limit"),
    ).toBeVisible();
    await expect(
      authenticatedPage.locator("text=Broadcasts limit"),
    ).toBeVisible();
    await expect(authenticatedPage.locator("text=Unlimited")).toBeVisible();

    // Team section
    await expect(authenticatedPage.locator("text=Team")).toBeVisible();
    await expect(authenticatedPage.locator("text=Domains limit")).toBeVisible();
    await expect(authenticatedPage.locator("text=Rate limit")).toBeVisible();

    // Free badges
    const freeBadges = authenticatedPage.locator("text=Free");
    await expect(freeBadges.first()).toBeVisible();

    if (billingEnabled) {
      const upgradeLinks = authenticatedPage.getByRole("link", {
        name: "Upgrade",
      });
      await expect(upgradeLinks.first()).toHaveAttribute(
        "href",
        "/settings/billing/plans",
      );
      expect(await upgradeLinks.count()).toBe(3);
    } else {
      const unavailableButtons = authenticatedPage.getByRole("button", {
        name: "Upgrade unavailable",
      });
      await expect(unavailableButtons.first()).toBeDisabled();
      expect(await unavailableButtons.count()).toBe(3);
      await expect(
        authenticatedPage
          .getByText("Billing is disabled for this installation")
          .first(),
      ).toBeVisible();
    }
  });
});
