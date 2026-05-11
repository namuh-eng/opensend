import { expect, test } from "./fixtures/auth";

test.describe("Emails Sending Data Table", () => {
  test("click email navigates to detail page", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/emails");

    // Wait for the data table to render
    const emailLink = page.locator("a[href^='/emails/']").first();
    const linkExists = await emailLink.isVisible().catch(() => false);

    if (linkExists) {
      const href = await emailLink.getAttribute("href");
      await emailLink.click();
      await page.waitForURL(href as string);
      expect(page.url()).toContain("/emails/");
    } else {
      // No emails — empty state should be visible
      await expect(
        page.getByRole("heading", { name: "No sent emails yet" }),
      ).toBeVisible();
    }
  });
});
