import { expect, test } from "./fixtures/auth";
// E2E category: smoke-only; contact detail test needs deterministic contact fixture follow-up (#229 audit).
test.skip(
  true,
  "E2E category: smoke-only; contact detail test needs deterministic contact fixture follow-up (#229 audit).",
);

test.describe("Contact Detail Page", () => {
  test("view contact detail from list", async ({ authenticatedPage: page }) => {
    // Navigate to audience page
    await page.goto("/audience");
    await page.waitForLoadState("networkidle");

    // Check if there are any contact links
    const contactLinks = page.locator('a[href*="/audience/contacts/"]');
    const count = await contactLinks.count();

    if (count === 0) {
      // No contacts exist — create one first
      await page.click('button:has-text("Add contacts")');
      await page.click('button:has-text("Add manually")');

      const modal = page.locator('[role="dialog"]');
      await expect(modal).toBeVisible();

      await modal.locator("textarea").fill("contact-detail-test@example.com");
      await modal.locator('button:has-text("Add")').click();

      // Wait for modal to close and contacts to refresh
      await expect(modal).not.toBeVisible({ timeout: 5000 });
      await page.waitForTimeout(1000);
      await page.reload();
      await page.waitForLoadState("networkidle");
    }

    // Click on the first contact email link
    const firstContact = page.locator('a[href*="/audience/contacts/"]').first();
    await expect(firstContact).toBeVisible();
    const contactEmail = await firstContact.textContent();
    await firstContact.click();

    // Verify contact detail page loads
    await page.waitForLoadState("networkidle");

    // Verify header
    await expect(page.locator("text=Contact").first()).toBeVisible();
    if (contactEmail) {
      await expect(page.locator(`text=${contactEmail}`).first()).toBeVisible();
    }

    // Verify metadata fields are populated
    await expect(page.locator("text=EMAIL ADDRESS")).toBeVisible();
    await expect(page.locator("text=CREATED")).toBeVisible();
    await expect(page.locator("text=STATUS")).toBeVisible();
    await expect(page.locator("text=ID")).toBeVisible();

    // Verify Properties section is visible
    await expect(page.locator("text=Properties")).toBeVisible();

    // Verify Activity section shows events
    await expect(page.locator("text=Activity").first()).toBeVisible();
    await expect(page.locator("text=Contact created")).toBeVisible();
  });
});
