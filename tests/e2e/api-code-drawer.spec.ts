import { expect, test } from "./fixtures/auth";

test.describe("API Code Drawer", () => {
  test("open and close API drawer on emails page", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/emails");

    // Click API drawer button
    const drawerBtn = page.locator('button[aria-label="API drawer"]');
    await expect(drawerBtn).toBeVisible();
    await drawerBtn.click();

    // Verify drawer slides in with correct title
    const drawer = page.locator("dialog[open]");
    await expect(drawer).toBeVisible();
    await expect(drawer.locator("h2")).toHaveText("Sending Email API");

    // Verify Node.js tab is active by default
    const nodejsTab = page.getByTestId("lang-tab-nodejs");
    await expect(nodejsTab).toBeVisible();

    // Verify code sections are present
    await expect(drawer.locator("h3", { hasText: "Send Email" })).toBeVisible();
    await expect(
      drawer.locator("h3", { hasText: "Send Batch Emails" }),
    ).toBeVisible();
    await expect(
      drawer.locator("h3", { hasText: "Retrieve Email" }),
    ).toBeVisible();
    await expect(
      drawer.locator("h3", { hasText: "Update Email" }),
    ).toBeVisible();

    // Verify Node.js code is shown
    await expect(drawer.locator("code").first()).toContainText("Resend");

    // Switch to cURL tab
    const curlTab = page.getByTestId("lang-tab-curl");
    await curlTab.click();
    await expect(drawer.locator("code").first()).toContainText("curl");

    // Close drawer via close button
    const closeBtn = drawer.locator('button[aria-label="Close"]');
    await closeBtn.click();

    // Verify drawer is hidden
    await expect(drawer).not.toBeVisible();
  });

  test("close drawer by pressing Escape", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/emails");

    const drawerBtn = page.locator('button[aria-label="API drawer"]');
    await drawerBtn.click();

    const drawer = page.locator("dialog[open]");
    await expect(drawer).toBeVisible();

    // Press Escape
    await page.keyboard.press("Escape");
    await expect(drawer).not.toBeVisible();
  });
});
