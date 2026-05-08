import { expect, test } from "./fixtures/auth";
// E2E category: smoke-only; email insights test needs deterministic email fixture follow-up (#229 audit).
test.skip(
  true,
  "E2E category: smoke-only; email insights test needs deterministic email fixture follow-up (#229 audit).",
);

test.describe("Email Detail - Content Tabs", () => {
  test("switch between content tabs including Insights", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/emails");
    await page.waitForLoadState("networkidle");

    const emailLink = page.locator('a[href^="/emails/"]').first();
    const hasEmails = (await emailLink.count()) > 0;

    if (hasEmails) {
      await emailLink.click();
      await page.waitForLoadState("networkidle");

      // Verify Preview tab is active by default
      const previewTab = page.getByRole("button", { name: "Preview" });
      await expect(previewTab).toHaveAttribute("data-state", "active");

      // Click HTML tab
      const htmlTab = page.getByRole("button", { name: "HTML" });
      await htmlTab.click();
      await expect(htmlTab).toHaveAttribute("data-state", "active");
      await expect(page.getByTestId("email-html")).toBeVisible();

      // Click Insights tab
      const insightsTab = page.getByRole("button", { name: /Insights/ });
      await insightsTab.click();
      await expect(insightsTab).toHaveAttribute("data-state", "active");

      // Verify deliverability report sections
      await expect(page.getByText("NEEDS ATTENTION")).toBeVisible();
      await expect(page.getByText("DOING GREAT")).toBeVisible();

      // Expand an accordion item
      await page.getByText("Include valid DMARC record").click();
      await expect(page.getByTestId("insight-detail-dmarc")).toBeVisible();

      // Switch back to Preview
      await previewTab.click();
      await expect(previewTab).toHaveAttribute("data-state", "active");
      await expect(page.getByTestId("email-preview")).toBeVisible();
    }
  });
});
