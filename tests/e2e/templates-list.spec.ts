import { expect, test } from "./fixtures/auth";

test.describe("Templates List Page", () => {
  test("navigate to template editor from card", async ({
    authenticatedPage: page,
    e2eDb,
    e2eUser,
  }) => {
    // Create a template first
    const res = await page.request.post("/api/templates", {
      data: {
        name: "E2E Test Template",
        html: "<p>E2E test template</p>",
      },
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
    await e2eDb.query("delete from templates where id = $1 and user_id = $2", [
      template.id,
      e2eUser.id,
    ]);
  });

  test("create new template", async ({
    authenticatedPage: page,
    e2eDb,
    e2eUser,
  }) => {
    await page.goto("/templates");
    await page.waitForLoadState("networkidle");

    // Click Create template button
    await page.getByRole("button", { name: "Create template" }).click();

    // Verify navigation to editor
    await expect(page).toHaveURL(/\/templates\/[^/]+\/editor/);
    const templateId = new URL(page.url()).pathname.split("/")[2];
    const result = await e2eDb.query<{ user_id: string | null }>(
      "select user_id from templates where id = $1",
      [templateId],
    );
    expect(result.rows[0]?.user_id).toBe(e2eUser.id);

    await e2eDb.query("delete from templates where id = $1 and user_id = $2", [
      templateId,
      e2eUser.id,
    ]);
  });
});
