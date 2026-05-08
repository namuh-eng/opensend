import { expect, test } from "./fixtures/auth";

test.describe("Add contact modal", () => {
  test("opens modal from Add contacts dropdown", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/audience");

    // Click "Add contacts" button
    await page.getByRole("button", { name: /add contacts/i }).click();

    // Click "Add manually"
    await page.getByText("Add manually").click();

    // Modal should be visible
    await expect(
      page.getByRole("heading", { name: "Add contacts" }),
    ).toBeVisible();
    await expect(
      page.getByPlaceholder("foo@gmail.com, bar@gmail.com"),
    ).toBeVisible();
    await expect(
      page.getByText(
        "Use commas or line breaks to separate multiple email addresses.",
      ),
    ).toBeVisible();
  });

  test("add single contact manually", async ({ authenticatedPage: page }) => {
    await page.goto("/audience");

    await page.getByRole("button", { name: /add contacts/i }).click();
    await page.getByText("Add manually").click();

    // Type email
    const uniqueEmail = `test-${Date.now()}@example.com`;
    await page
      .getByPlaceholder("foo@gmail.com, bar@gmail.com")
      .fill(uniqueEmail);

    // Click Add
    await page.getByRole("button", { name: "Add", exact: true }).click();

    // Modal should close
    await expect(
      page.getByRole("heading", { name: "Add contacts" }),
    ).not.toBeVisible();
  });

  test("closes modal with Cancel button", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/audience");

    await page.getByRole("button", { name: /add contacts/i }).click();
    await page.getByText("Add manually").click();

    await expect(
      page.getByRole("heading", { name: "Add contacts" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Cancel" }).click();

    await expect(
      page.getByRole("heading", { name: "Add contacts" }),
    ).not.toBeVisible();
  });

  test("closes modal with X button", async ({ authenticatedPage: page }) => {
    await page.goto("/audience");

    await page.getByRole("button", { name: /add contacts/i }).click();
    await page.getByText("Add manually").click();

    await expect(
      page.getByRole("heading", { name: "Add contacts" }),
    ).toBeVisible();

    await page.getByRole("button", { name: /close/i }).click();

    await expect(
      page.getByRole("heading", { name: "Add contacts" }),
    ).not.toBeVisible();
  });

  test("shows segments search field", async ({ authenticatedPage: page }) => {
    await page.goto("/audience");

    await page.getByRole("button", { name: /add contacts/i }).click();
    await page.getByText("Add manually").click();

    await expect(page.getByPlaceholder("Search segments...")).toBeVisible();
  });
});
