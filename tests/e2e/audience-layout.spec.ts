import { expect, test } from "./fixtures/auth";

test.describe("Audience page layout", () => {
  test("renders Audience page with 4 tabs, Contacts active by default", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/audience");
    await expect(page.locator("h1")).toHaveText("Audience");

    const contactsTab = page.locator('a[data-state="active"]');
    await expect(contactsTab).toHaveText("Contacts");

    await expect(page.getByText("Properties")).toBeVisible();
    await expect(page.getByText("Segments")).toBeVisible();
    await expect(page.getByText("Topics")).toBeVisible();
  });

  test("navigate between Audience tabs", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/audience");

    // Contacts tab active by default
    await expect(page.locator('a[data-state="active"]')).toHaveText("Contacts");

    // Click Properties tab
    await page.getByText("Properties").click();
    await expect(page).toHaveURL(/\/audience\/properties/);
    await expect(
      page.locator('a[href="/audience/properties"][data-state="active"]'),
    ).toBeVisible();

    // Click Segments tab
    await page.getByText("Segments").click();
    await expect(page).toHaveURL(/\/audience\/segments/);
    await expect(
      page.locator('a[href="/audience/segments"][data-state="active"]'),
    ).toBeVisible();

    // Click Topics tab
    await page.getByText("Topics").click();
    await expect(page).toHaveURL(/\/audience\/topics/);
    await expect(
      page.locator('a[href="/audience/topics"][data-state="active"]'),
    ).toBeVisible();
  });

  test("direct URL to Topics tab shows Topics as active", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/audience/topics");
    await expect(
      page.locator('a[href="/audience/topics"][data-state="active"]'),
    ).toBeVisible();
  });

  test("summary stats are visible", async ({ authenticatedPage: page }) => {
    await page.goto("/audience");
    await expect(
      page.getByText("ALL CONTACTS", { exact: true }).first(),
    ).toBeVisible();
    await expect(
      page.getByText("SUBSCRIBERS", { exact: true }).first(),
    ).toBeVisible();
    await expect(
      page.getByText("UNSUBSCRIBERS", { exact: true }).first(),
    ).toBeVisible();
    await expect(
      page.getByText("METRICS", { exact: true }).first(),
    ).toBeVisible();
  });

  test("Add contacts dropdown shows options", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/audience");
    await page.getByRole("button", { name: /add contacts/i }).click();
    await expect(page.getByText("Add manually")).toBeVisible();
    await expect(page.getByText("Import CSV")).toBeVisible();
  });
});
