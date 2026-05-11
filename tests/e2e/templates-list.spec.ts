import { expect, test } from "./fixtures/auth";
// E2E category: smoke-only; templates list/create tests need deterministic template fixture follow-up (#229 audit).
test.skip(
  true,
  "E2E category: smoke-only; templates list/create tests need deterministic template fixture follow-up (#229 audit).",
);

test.describe("Templates List Page", () => {
  test("navigate to template editor from card", async ({
    authenticatedPage: page,
  }) => {
    // Create a template first
    const res = await page.request.post("/api/templates", {
      data: { name: "E2E Test Template" },
    });
    expect(res.ok()).toBeTruthy();
    const template = await res.json();

    await page.goto("/templates");
    await page.waitForLoadState("networkidle");

    // Click on the template card link
    const link = page.getByRole("link", { name: "E2E Test Template" });
    await expect(link).toBeVisible();
    await link.click();

    // Verify URL changes to editor
    await expect(page).toHaveURL(
      new RegExp(`/templates/${template.id}/editor`),
    );

    // Cleanup
    await page.request.delete(`/api/templates/${template.id}`);
  });

  test("create new template", async ({ authenticatedPage: page }) => {
    await page.goto("/templates");
    await page.waitForLoadState("networkidle");

    // Click Create template button
    await page.getByRole("button", { name: "Create template" }).click();

    // Verify navigation to editor
    await expect(page).toHaveURL(/\/templates\/[^/]+\/editor/);
  });
});
