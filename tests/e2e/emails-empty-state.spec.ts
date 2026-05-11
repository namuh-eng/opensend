import { expect, test } from "./fixtures/auth";

test.describe("Emails empty state", () => {
  test("authenticated zero-email account sees onboarding and docs CTA", async ({
    authenticatedPage: page,
    e2eDb,
    e2eUser,
  }) => {
    await e2eDb.query("delete from emails where user_id = $1", [e2eUser.id]);

    await page.goto("/emails");

    await expect(
      page.getByRole("heading", { name: "No sent emails yet" }),
    ).toBeVisible();
    await expect(
      page.getByText(
        "Start sending emails to see insights and previews for every message.",
      ),
    ).toBeVisible();

    const docsLink = page.getByRole("link", { name: "Go to docs" });
    await expect(docsLink).toBeVisible();
    await expect(docsLink).toHaveAttribute("href", "/docs");

    await docsLink.click();
    await expect(page).toHaveURL(/\/docs(?:$|[?#])/);
  });
});
