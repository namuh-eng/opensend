import { randomUUID } from "node:crypto";
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

  test("edits and publishes a template through the dashboard editor", async ({
    authenticatedPage: page,
    e2eDb,
    e2eUser,
  }) => {
    const templateId = randomUUID();
    await e2eDb.query(
      `insert into templates
        (id, name, alias, status, subject, html, text, user_id, created_at)
       values
        ($1, 'Editable Template', 'editable-template', 'draft', 'Old subject', '<p>Old body</p>', 'Old body', $2, now())`,
      [templateId, e2eUser.id],
    );

    await page.goto(`/templates/${templateId}/editor`);
    await page.waitForLoadState("networkidle");

    await expect(
      page.getByRole("heading", { name: "Template editor" }),
    ).toBeVisible();
    await expect(page.getByLabel("Template name")).toHaveValue(
      "Editable Template",
    );

    await page.getByLabel("Template name").fill("Edited Template");
    await page.getByLabel("Subject").fill("New subject {{firstName}}");
    await page.getByLabel("HTML").fill("<h1>Hello {{firstName}}</h1>");
    await page.getByLabel("Text/plain fallback").fill("Hello {{firstName}}");
    await page.getByRole("button", { name: "Save" }).click();

    await expect(page.getByText("Template saved.")).toBeVisible();

    const saved = await e2eDb.query<{
      name: string;
      subject: string | null;
      html: string | null;
      text: string | null;
      variables: Array<{ key: string }> | null;
      status: string;
    }>(
      "select name, subject, html, text, variables, status from templates where id = $1 and user_id = $2",
      [templateId, e2eUser.id],
    );
    expect(saved.rows[0]).toMatchObject({
      name: "Edited Template",
      subject: "New subject {{firstName}}",
      html: "<h1>Hello {{firstName}}</h1>",
      text: "Hello {{firstName}}",
      status: "draft",
    });
    expect(saved.rows[0]?.variables?.map((variable) => variable.key)).toContain(
      "firstName",
    );

    await page.getByRole("button", { name: "Publish" }).click();
    await expect(page.getByText("Template published.")).toBeVisible();

    const published = await e2eDb.query<{ status: string }>(
      "select status from templates where id = $1 and user_id = $2",
      [templateId, e2eUser.id],
    );
    expect(published.rows[0]?.status).toBe("published");

    await e2eDb.query("delete from templates where id = $1 and user_id = $2", [
      templateId,
      e2eUser.id,
    ]);
  });

  test("renders React Email-backed template preview with text and variable diagnostics", async ({
    authenticatedPage: page,
    e2eDb,
    e2eUser,
  }) => {
    const templateId = randomUUID();
    await e2eDb.query(
      `insert into templates
        (id, name, alias, status, html, variables, document, user_id, created_at)
       values
        ($1, 'E2E React Email Starter', 'e2e-react-email-starter', 'draft',
         '<!-- React Email registry template: onboarding-welcome -->',
         $2::jsonb, $3::jsonb, $4, now())`,
      [
        templateId,
        JSON.stringify([
          {
            name: "productName",
            key: "productName",
            type: "string",
            required: false,
            fallbackValue: "Opensend",
          },
          {
            name: "actionUrl",
            key: "actionUrl",
            type: "string",
            required: true,
            fallbackValue: null,
          },
        ]),
        JSON.stringify({
          rendering: {
            kind: "react_email",
            templateKey: "onboarding-welcome",
          },
        }),
        e2eUser.id,
      ],
    );

    await page.goto(`/templates/${templateId}`);
    await page.waitForLoadState("networkidle");

    await expect(
      page.getByRole("heading", { name: "E2E React Email Starter" }),
    ).toBeVisible();
    await expect(
      page.getByText("React Email registry template:"),
    ).toBeVisible();
    await expect(page.getByText("Variable resolution")).toBeVisible();
    await expect(page.getByRole("cell", { name: "Fallback" })).toBeVisible();
    await expect(
      page.getByRole("cell", { name: "Preview sample" }),
    ).toBeVisible();
    await expect(
      page.getByRole("cell", { name: "Required before send" }),
    ).toBeVisible();
    await expect(page.getByTestId("template-text-preview")).toContainText(
      "Open the setup checklist",
    );
    await expect(
      page
        .frameLocator('iframe[title="Template Preview"]')
        .getByText("Your email workspace is ready"),
    ).toBeVisible();

    await e2eDb.query("delete from templates where id = $1 and user_id = $2", [
      templateId,
      e2eUser.id,
    ]);
  });
});
