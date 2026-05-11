import { expect, test } from "./fixtures/auth";
// E2E category: smoke-only; sidebar editor test needs deterministic broadcast creation with auth-aware request fixture follow-up (#229 audit).
test.skip(
  true,
  "E2E category: smoke-only; sidebar editor test needs deterministic broadcast creation with auth-aware request fixture follow-up (#229 audit).",
);

test.describe("Broadcast Editor Right Sidebar", () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    // Create a broadcast first, then navigate to editor
    const res = await page.request.post("/api/broadcasts", {
      data: { name: "Sidebar Test Broadcast" },
    });
    const broadcast = await res.json();
    await page.goto(`/broadcasts/${broadcast.id}/editor`);
    await page.waitForLoadState("networkidle");
  });

  test("switch theme preset", async ({ authenticatedPage: page }) => {
    // Open the right sidebar by clicking the settings/style button
    const styleButton = page.locator(
      'button:has-text("Page style"), button[aria-label="Page style"]',
    );
    if (await styleButton.isVisible()) {
      await styleButton.click();
    }

    // Look for the sidebar
    const sidebar = page.locator('[data-testid="editor-right-sidebar"]');
    await expect(sidebar).toBeVisible({ timeout: 5000 });

    // Click "Edit theme" to switch to theme panel
    const editThemeBtn = page.locator('button:has-text("Edit theme")');
    if (await editThemeBtn.isVisible()) {
      await editThemeBtn.click();
    }

    // Find theme preset buttons
    const minimalBtn = page.locator(
      '[data-testid="theme-preset-minimal"], button:has-text("Minimal")',
    );
    const basicBtn = page.locator(
      '[data-testid="theme-preset-basic"], button:has-text("Basic")',
    );

    // Click minimal preset
    await minimalBtn.click();

    // Verify minimal is selected (should have active styling)
    await expect(minimalBtn).toHaveAttribute("data-active", "true");

    // Switch to basic
    await basicBtn.click();
    await expect(basicBtn).toHaveAttribute("data-active", "true");
  });

  test("page style panel shows default values", async ({
    authenticatedPage: page,
  }) => {
    // Open sidebar
    const styleButton = page.locator(
      'button:has-text("Page style"), button[aria-label="Page style"]',
    );
    if (await styleButton.isVisible()) {
      await styleButton.click();
    }

    const sidebar = page.locator('[data-testid="editor-right-sidebar"]');
    await expect(sidebar).toBeVisible({ timeout: 5000 });

    // Check default width value
    const widthInput = sidebar.locator('input[data-testid="body-width"]');
    await expect(widthInput).toHaveValue("600");
  });

  test("global CSS editor with quick-insert buttons", async ({
    authenticatedPage: page,
  }) => {
    // Open sidebar
    const styleButton = page.locator(
      'button:has-text("Page style"), button[aria-label="Page style"]',
    );
    if (await styleButton.isVisible()) {
      await styleButton.click();
    }

    const sidebar = page.locator('[data-testid="editor-right-sidebar"]');
    await expect(sidebar).toBeVisible({ timeout: 5000 });

    // Navigate to Global CSS panel
    const globalCssBtn = page.locator('button:has-text("Global CSS")').first();
    await globalCssBtn.click();

    // Check quick-insert buttons exist
    await expect(page.locator('button:has-text("@media dark")')).toBeVisible();
    await expect(
      page.locator('button:has-text("@media mobile")'),
    ).toBeVisible();
    await expect(page.locator('button:has-text(".button")')).toBeVisible();

    // Click a quick-insert button and verify content is added
    await page.locator('button:has-text("@media dark")').click();
    const cssEditor = sidebar.locator(
      '[data-testid="global-css-editor"], textarea',
    );
    await expect(cssEditor).toContainText("prefers-color-scheme");
  });

  test("close sidebar button works", async ({ authenticatedPage: page }) => {
    // Open sidebar
    const styleButton = page.locator(
      'button:has-text("Page style"), button[aria-label="Page style"]',
    );
    if (await styleButton.isVisible()) {
      await styleButton.click();
    }

    const sidebar = page.locator('[data-testid="editor-right-sidebar"]');
    await expect(sidebar).toBeVisible({ timeout: 5000 });

    // Close the sidebar
    const closeBtn = sidebar.locator(
      'button[aria-label="Close sidebar"], button:has-text("Close")',
    );
    await closeBtn.click();

    await expect(sidebar).not.toBeVisible();
  });
});
