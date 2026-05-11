import { expect, test } from "./fixtures/auth";
// E2E category: smoke-only; API key detail UI needs deterministic API-key/dashboard fixture follow-up (#229 audit).
test.skip(
  true,
  "E2E category: smoke-only; API key detail UI needs deterministic API-key/dashboard fixture follow-up (#229 audit).",
);

test.describe("API Key Detail Page", () => {
  test("edit API key name", async ({ authenticatedPage: page }) => {
    // Navigate to API keys list
    await page.goto("/api-keys");
    await page.waitForLoadState("networkidle");

    // Check if any API keys exist; if not, create one
    const rows = page.locator("table tbody tr");
    const rowCount = await rows.count();

    if (rowCount === 0) {
      // Create an API key first
      await page.click('button:has-text("Create API Key")');
      await page.fill('input[id="ak-name"]', "E2E Test Key");
      await page.click('button:has-text("Add")');
      // Close the token reveal modal
      await page.click('button:has-text("Cancel")');
      await page.waitForLoadState("networkidle");
    }

    // Click first API key name to navigate to detail
    const firstKeyLink = page
      .locator("table tbody tr")
      .first()
      .locator("button")
      .first();
    await firstKeyLink.click();
    await page.waitForLoadState("networkidle");

    // Verify we're on detail page
    await expect(page.locator("h1")).toBeVisible();
    const originalName = await page.locator("h1").textContent();

    // Click More actions
    await page.click('[aria-label="More actions"]');

    // Click Edit API key
    await page.click('button:has-text("Edit API key")');

    // Verify edit modal opens
    await expect(page.locator("text=Edit API Key")).toBeVisible();

    // Change name
    const nameInput = page.locator('input[id="edit-name"]');
    await nameInput.clear();
    await nameInput.fill("Updated Key");

    // Click Save
    await page.click('button:has-text("Save")');

    // Verify name updated in heading
    await expect(page.locator("h1")).toHaveText("Updated Key");

    // Restore original name if it existed
    if (originalName && originalName !== "Updated Key") {
      await page.click('[aria-label="More actions"]');
      await page.click('button:has-text("Edit API key")');
      const input = page.locator('input[id="edit-name"]');
      await input.clear();
      await input.fill(originalName);
      await page.click('button:has-text("Save")');
    }
  });
});
