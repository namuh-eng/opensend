// ABOUTME: E2E tests for bounce rate section — info panel open/close, breakdown links

import { expect, test } from "./fixtures/auth";

test.describe("Bounce Rate Section", () => {
  test("should open and close bounce rate info panel", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/metrics");

    // Find the bounce rate section and its info button
    const bounceSection = page.locator("text=BOUNCE RATE").first();
    await expect(bounceSection).toBeVisible();

    // Click the info chevron button within the bounce rate section area
    const infoBtn = page.getByRole("button", { name: /bounce rate info/i });
    await infoBtn.click();

    // Verify info panel opens with correct title
    await expect(page.getByText("How Bounce Rate Works")).toBeVisible();

    // Verify panel contains bounce type explanations
    await expect(page.getByText(/Permanent.*hard bounce/i)).toBeVisible();
    await expect(page.getByText(/Transient.*soft bounce/i)).toBeVisible();
    await expect(page.getByText(/Undetermined/i).first()).toBeVisible();

    // Close the panel
    const closeBtn = page.getByRole("button", { name: /close/i });
    await closeBtn.click();

    // Verify panel is closed
    await expect(page.getByText("How Bounce Rate Works")).not.toBeVisible();
  });

  test("should show bounce breakdown table with category rows", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/metrics");

    // The bounce rate section should show breakdown categories
    const bounceSection = page
      .locator("[data-section]")
      .filter({ hasText: "BOUNCE RATE" });
    await expect(bounceSection).toBeVisible();

    // Should have breakdown row labels
    await expect(bounceSection.getByText("Transient")).toBeVisible();
    await expect(bounceSection.getByText("Permanent")).toBeVisible();
    await expect(bounceSection.getByText("Undetermined")).toBeVisible();
  });

  test("should close info panel on Escape key", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/metrics");

    const infoBtn = page.getByRole("button", { name: /bounce rate info/i });
    await infoBtn.click();
    await expect(page.getByText("How Bounce Rate Works")).toBeVisible();

    // Press Escape
    await page.keyboard.press("Escape");
    await expect(page.getByText("How Bounce Rate Works")).not.toBeVisible();
  });
});
