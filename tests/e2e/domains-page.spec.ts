import { expect, test } from "./fixtures/auth";

test.describe("Domains Page", () => {
  test("renders domains page with title and filter bar", async ({
    authenticatedPage,
  }) => {
    await authenticatedPage.goto("/domains");
    await expect(
      authenticatedPage.getByRole("heading", { name: "Domains" }),
    ).toBeVisible();
    await expect(authenticatedPage.getByPlaceholder("Search...")).toBeVisible();
    await expect(authenticatedPage.getByText("All Statuses")).toBeVisible();
    await expect(authenticatedPage.getByText("All Regions")).toBeVisible();
    await expect(authenticatedPage.getByText("Add domain")).toBeVisible();
  });

  test("click domain name navigates to detail page", async ({
    authenticatedPage,
  }) => {
    await authenticatedPage.goto("/domains");
    const domainLink = authenticatedPage.locator("table a").first();
    const count = await domainLink.count();
    test.skip(
      count === 0,
      "Seed a domain to run domain detail navigation smoke E2E.",
    );

    const href = await domainLink.getAttribute("href");
    expect(href).toBeTruthy();
    await domainLink.click();
    await expect(authenticatedPage).toHaveURL(href as string);
  });
});
