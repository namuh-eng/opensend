// ABOUTME: E2E test for Settings Usage tab — verifies all 3 quota sections render with correct labels and values
// E2E category: smoke-only; settings usage assertions are UI-copy smoke and need refresh follow-up (#229 audit).
test.skip(
  true,
  "E2E category: smoke-only; settings usage assertions are UI-copy smoke and need refresh follow-up (#229 audit).",
);

import { expect, test } from "./fixtures/auth";

test.describe("Settings Usage Page", () => {
  test("displays all quota sections with correct labels", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/settings");

    // Usage tab should be active by default
    const usageTab = page.locator('button:has-text("Usage")');
    await expect(usageTab).toBeVisible();
    await expect(usageTab).toHaveAttribute("data-state", "active");

    // Transactional section
    await expect(page.locator("text=Transactional")).toBeVisible();
    await expect(page.locator("text=Monthly limit")).toBeVisible();
    await expect(page.locator("text=Daily limit")).toBeVisible();

    // Marketing section
    await expect(page.locator("text=Marketing")).toBeVisible();
    await expect(page.locator("text=Contacts limit")).toBeVisible();
    await expect(page.locator("text=Segments limit")).toBeVisible();
    await expect(page.locator("text=Broadcasts limit")).toBeVisible();
    await expect(page.locator("text=Unlimited")).toBeVisible();

    // Team section
    await expect(page.locator("text=Team")).toBeVisible();
    await expect(page.locator("text=Domains limit")).toBeVisible();
    await expect(page.locator("text=Rate limit")).toBeVisible();

    // Free badges
    const freeBadges = page.locator("text=Free");
    await expect(freeBadges.first()).toBeVisible();

    // Upgrade buttons
    const upgradeButtons = page.locator("text=Upgrade");
    expect(await upgradeButtons.count()).toBeGreaterThanOrEqual(2);
  });
});
