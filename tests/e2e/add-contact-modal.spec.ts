import { expect, test } from "./fixtures/auth";

test.describe("Add contact modal", () => {
  test("opens modal from Add contacts dropdown", async ({
    authenticatedPage: page,
  }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

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
    await expect(page.getByText("This page couldn’t load")).not.toBeVisible();
    expect(pageErrors).toEqual([]);
  });

  test("add single contact manually", async ({
    authenticatedPage: page,
    e2eDb,
    e2eRunId,
    e2eTenant,
  }) => {
    await page.goto("/audience");

    await page.getByRole("button", { name: /add contacts/i }).click();
    await page.getByText("Add manually").click();
    await expect(
      page.getByRole("heading", { name: "Add contacts" }),
    ).toBeVisible();

    // Type email
    const uniqueEmail = `manual-${Date.now()}@${e2eRunId}.e2e.opensend.test`;
    await page
      .getByPlaceholder("foo@gmail.com, bar@gmail.com")
      .fill(uniqueEmail);

    // Click Add
    await page.getByRole("button", { name: "Add", exact: true }).click();

    // Modal should close
    await expect(
      page.getByRole("heading", { name: "Add contacts" }),
    ).not.toBeVisible();

    const { rows } = await e2eDb.query<{
      email: string;
      user_id: string | null;
    }>(
      `select email, user_id
       from contacts
       where email = $1`,
      [uniqueEmail],
    );

    expect(rows).toEqual([
      {
        email: uniqueEmail,
        user_id: e2eTenant.user.id,
      },
    ]);
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
