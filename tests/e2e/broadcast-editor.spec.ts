import { expect, test } from "./fixtures/auth";
// E2E category: smoke-only; broadcast editor tests need deterministic broadcast fixture follow-up (#229 audit).
test.skip(
  true,
  "E2E category: smoke-only; broadcast editor tests need deterministic broadcast fixture follow-up (#229 audit).",
);

test.describe("Broadcast Editor", () => {
  test("edit broadcast title inline", async ({ authenticatedPage: page }) => {
    // Create a broadcast first
    const res = await page.request.post("/api/broadcasts", {
      data: { name: "Untitled" },
    });
    const broadcast = await res.json();

    // Navigate to editor
    await page.goto(`/broadcasts/${broadcast.id}/editor`);

    // Wait for editor to load
    await page.waitForSelector('input[value="Untitled"]');

    // Click on the title and edit it
    const titleInput = page.locator('input[value="Untitled"]');
    await titleInput.fill("My Newsletter");

    // Click outside to blur
    await page.locator("body").click({ position: { x: 0, y: 0 } });

    // Wait for auto-save
    await page.waitForTimeout(1500);

    // Verify title persisted by reloading
    await page.reload();
    await page.waitForSelector('input[value="My Newsletter"]');
    const updatedTitle = page.locator('input[value="My Newsletter"]');
    await expect(updatedTitle).toBeVisible();

    // Cleanup
    await page.request.delete(`/api/broadcasts/${broadcast.id}`);
  });

  test("insert heading block via slash command", async ({
    authenticatedPage: page,
  }) => {
    // Create a broadcast
    const res = await page.request.post("/api/broadcasts", {
      data: { name: "Slash Test" },
    });
    const broadcast = await res.json();

    // Navigate to editor
    await page.goto(`/broadcasts/${broadcast.id}/editor`);

    // Wait for block editor to load
    await page.waitForSelector('[data-testid="block-editor"]');

    // Click the editor area and press /
    const editor = page.locator('[data-testid="block-editor"]');
    await editor.click();
    await editor.press("/");

    // Wait for slash menu to appear with Heading option
    await expect(page.getByText("Heading")).toBeVisible();

    // Click Heading
    await page.getByText("Heading").click();

    // Verify heading block appeared
    await expect(page.locator('[data-testid="block-heading"]')).toBeVisible();

    // Type in the heading
    const headingInput = page.locator('[data-testid="block-heading"] input');
    await headingInput.fill("Hello World");
    await expect(headingInput).toHaveValue("Hello World");

    // Cleanup
    await page.request.delete(`/api/broadcasts/${broadcast.id}`);
  });
});
