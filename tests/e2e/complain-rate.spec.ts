// ABOUTME: E2E tests for complain rate section — info panel open/close, breakdown link, Escape key

import { expect, test } from "./fixtures/auth";

test.describe("Complain Rate Section", () => {
  test("should open and close complain rate info panel", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/metrics");

    // Find the complain rate section
    const complainSection = page.locator("text=COMPLAIN RATE").first();
    await expect(complainSection).toBeVisible();

    // Click the info chevron button within the complain rate section area
    const infoBtn = page.getByRole("button", { name: /complain rate info/i });
    await infoBtn.click();

    // Verify info panel opens with correct title
    await expect(page.getByText("How Complain Rate Works")).toBeVisible();

    // Verify panel contains complaint explanations
    await expect(page.getByText(/marks your email as spam/i)).toBeVisible();

    // Close the panel
    const closeBtn = page.getByRole("button", { name: /close/i });
    await closeBtn.click();

    // Verify panel is closed
    await expect(page.getByText("How Complain Rate Works")).not.toBeVisible();
  });

  test("should show complain breakdown table with Complained row", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/metrics");

    // The complain rate section should show breakdown category
    const complainSection = page
      .locator("[data-section]")
      .filter({ hasText: "COMPLAIN RATE" });
    await expect(complainSection).toBeVisible();

    // Should have Complained breakdown row
    await expect(complainSection.getByText("Complained")).toBeVisible();
  });

  test("should close info panel on Escape key", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/metrics");

    const infoBtn = page.getByRole("button", { name: /complain rate info/i });
    await infoBtn.click();
    await expect(page.getByText("How Complain Rate Works")).toBeVisible();

    // Press Escape
    await page.keyboard.press("Escape");
    await expect(page.getByText("How Complain Rate Works")).not.toBeVisible();
  });
});
