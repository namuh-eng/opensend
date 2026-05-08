import { expect, test } from "./fixtures/auth";
// E2E category: smoke-only; segments flows need deterministic segment fixture/cleanup follow-up (#229 audit).
test.skip(
  true,
  "E2E category: smoke-only; segments flows need deterministic segment fixture/cleanup follow-up (#229 audit).",
);

test.describe("Segments page", () => {
  test("create new segment", async ({ authenticatedPage: page }) => {
    await page.goto("/audience/segments");

    // Click 'Create segment' button
    await page.click("text=Create segment");

    // Type segment name
    const nameInput = page.getByPlaceholder("Your segment name");
    await expect(nameInput).toBeVisible();
    await nameInput.fill("VIP Customers");

    // Click Add
    await page.click("button:has-text('Add')");

    // Verify segment appears in list
    await expect(page.getByText("VIP Customers")).toBeVisible({
      timeout: 5000,
    });
  });

  test("click segment navigates to filtered contacts", async ({
    authenticatedPage: page,
  }) => {
    // First create a segment
    await page.goto("/audience/segments");

    await page.click("text=Create segment");
    const nameInput = page.getByPlaceholder("Your segment name");
    await nameInput.fill("General");
    await page.click("button:has-text('Add')");
    await expect(page.getByText("General")).toBeVisible({ timeout: 5000 });

    // Click on the segment name link
    await page.click("a:has-text('General')");

    // Verify URL changes to /audience with segmentId
    await page.waitForURL(/\/audience\?segmentId=/);

    // Verify we're on the Contacts tab
    const contactsTab = page.locator("[data-state='active']", {
      hasText: "Contacts",
    });
    await expect(contactsTab).toBeVisible();
  });
});
