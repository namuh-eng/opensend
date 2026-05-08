import { expect, test } from "./fixtures/auth";
// E2E category: smoke-only; email detail test needs deterministic email fixture follow-up (#229 audit).
test.skip(
  true,
  "E2E category: smoke-only; email detail test needs deterministic email fixture follow-up (#229 audit).",
);

test.describe("Email Detail Page", () => {
  test("view email detail page shows metadata and events", async ({
    authenticatedPage: page,
  }) => {
    // Navigate to an email detail page directly
    // First go to emails list to find an email
    await page.goto("/emails");
    await page.waitForLoadState("networkidle");

    // Check if there are any email links
    const emailLink = page.locator('a[href^="/emails/"]').first();
    const hasEmails = (await emailLink.count()) > 0;

    if (hasEmails) {
      // Click the first email
      await emailLink.click();
      await page.waitForLoadState("networkidle");

      // Verify metadata fields
      await expect(page.getByText("FROM")).toBeVisible();
      await expect(page.getByText("SUBJECT")).toBeVisible();
      await expect(page.getByText("TO")).toBeVisible();
      await expect(page.getByText("ID")).toBeVisible();

      // Verify Email Events section
      await expect(page.getByText("EMAIL EVENTS")).toBeVisible();

      // Verify content tabs
      await expect(page.getByText("Preview")).toBeVisible();
      await expect(page.getByText("Plain Text")).toBeVisible();
      await expect(page.getByText("HTML")).toBeVisible();
      await expect(
        page.getByRole("button", { name: /Insights/ }),
      ).toBeVisible();

      // Verify envelope icon
      await expect(page.getByTestId("email-envelope-icon")).toBeVisible();
    }
  });
});
