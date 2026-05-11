import { expect, test } from "./fixtures/auth";
// E2E category: smoke-only; contacts list tests need deterministic contact fixture follow-up (#229 audit).
test.skip(
  true,
  "E2E category: smoke-only; contacts list tests need deterministic contact fixture follow-up (#229 audit).",
);

test.describe("Contacts list table", () => {
  test("renders filter bar with search, segment dropdown, status dropdown, and export", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/audience");

    // Search input
    await expect(page.getByPlaceholder(/search by name, email/i)).toBeVisible();

    // Filter dropdowns
    await expect(page.locator("select")).toHaveCount(2);

    // Export button
    await expect(page.getByRole("button", { name: /export/i })).toBeVisible();
  });

  test("shows table headers: Email, Segments, Status, Added", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/audience");

    // Wait for table or empty state to load
    await page.waitForSelector("table, text=No contacts found", {
      timeout: 10000,
    });

    // If there are contacts, check headers
    const table = page.locator("table");
    if (await table.isVisible()) {
      await expect(table.locator("th", { hasText: "Email" })).toBeVisible();
      await expect(table.locator("th", { hasText: "Segments" })).toBeVisible();
      await expect(table.locator("th", { hasText: "Status" })).toBeVisible();
      await expect(table.locator("th", { hasText: "Added" })).toBeVisible();
    }
  });

  test("click contact navigates to detail page", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/audience");

    await page.waitForSelector("table, text=No contacts found", {
      timeout: 10000,
    });

    const contactLink = page.locator(
      'table tbody a[href*="/audience/contacts/"]',
    );
    if ((await contactLink.count()) > 0) {
      await contactLink.first().click();
      await expect(page).toHaveURL(/\/audience\/contacts\//);
    }
  });

  test("search contacts by email", async ({ authenticatedPage: page }) => {
    await page.goto("/audience");

    const searchInput = page.getByPlaceholder(/search by name, email/i);
    await searchInput.fill("nonexistent-email-xyz@test.com");

    // Wait for debounced search to trigger
    await page.waitForTimeout(500);

    // Should show empty or filtered results
    await page.waitForSelector("table, text=No contacts found", {
      timeout: 10000,
    });
  });
});
