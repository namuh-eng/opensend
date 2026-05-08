import { expect, test } from "./fixtures/auth";
// E2E category: smoke-only; properties create flow needs deterministic modal/cleanup follow-up (#229 audit).
test.skip(
  true,
  "E2E category: smoke-only; properties create flow needs deterministic modal/cleanup follow-up (#229 audit).",
);

test.describe("Properties page", () => {
  test("create new property", async ({ authenticatedPage: page }) => {
    await page.goto("/audience/properties");

    // Click 'Add property' button
    await page.click("text=Add property");

    // Modal should appear
    await expect(page.locator("text=Add a new property")).toBeVisible();

    // Type property name
    await page.fill('input[placeholder="e.g., company_name"]', "phone_number");

    // Select String type (default)
    await expect(page.locator("select >> nth=0")).toBeVisible();

    // Click Add button
    await page.click('button:has-text("Add"):not(:has-text("Add property"))');

    // Verify property appears in list
    await expect(page.locator("text=phone_number")).toBeVisible({
      timeout: 5000,
    });
  });
});
