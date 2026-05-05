import { expect, test } from "@playwright/test";

test.describe("Domain DNS Records Tab (feature-025)", () => {
  test("view DNS records for verified domain", async ({ page }) => {
    // Navigate to domains list first
    await page.goto("/domains");
    await page.waitForLoadState("networkidle");

    // Click on first domain link if available
    const domainLink = page.locator("a[href^='/domains/']").first();
    const hasDomains = (await domainLink.count()) > 0;

    if (!hasDomains) {
      test.skip();
      return;
    }

    await domainLink.click();
    await page.waitForLoadState("networkidle");

    // Click Records tab
    const recordsTab = page.getByText("Records", { exact: true });
    await recordsTab.click();
    expect(await recordsTab.getAttribute("data-state")).toBe("active");

    // Verify DNS Records section renders
    await expect(page.getByText("DNS Records")).toBeVisible();
    await expect(page.getByText("Domain Verification")).toBeVisible();
    await expect(page.getByText("DKIM")).toBeVisible();

    // Verify table columns
    await expect(page.getByText("Type")).toBeVisible();
    await expect(page.getByText("Name")).toBeVisible();
    await expect(page.getByText("Content")).toBeVisible();
    await expect(page.getByText("TTL")).toBeVisible();
    await expect(page.getByText("Priority")).toBeVisible();
    await expect(page.getByText("Status")).toBeVisible();

    // Verify Enable Sending section
    await expect(page.getByText("Enable Sending")).toBeVisible();
    await expect(page.getByTestId("sending-toggle")).toBeVisible();

    // Verify DMARC guidance section
    await expect(page.getByText("DMARC Policy")).toBeVisible();
    await expect(
      page.getByText(/evaluate SPF and DKIM alignment/),
    ).toBeVisible();

    // Verify Enable Receiving section
    await expect(page.getByText("Enable Receiving")).toBeVisible();
    await expect(page.getByTestId("receiving-toggle")).toBeVisible();

    // Verify Auto configure button
    await expect(page.getByText("Auto configure")).toBeVisible();
  });
});
