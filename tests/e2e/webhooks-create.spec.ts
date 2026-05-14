import { expect, test } from "./fixtures/auth";

test("dashboard empty webhooks page creates an endpoint through the real API route", async ({
  authenticatedPage,
  e2eDb,
  e2eRunId,
  e2eUser,
}) => {
  const endpoint = `https://example.com/opensend/${e2eRunId}`;

  await authenticatedPage.goto("/webhooks");

  await expect(
    authenticatedPage.getByRole("heading", { name: "Webhooks" }),
  ).toBeVisible();
  await expect(
    authenticatedPage.getByRole("button", { name: "Add endpoint" }),
  ).toBeVisible();
  await expect(
    authenticatedPage.getByRole("button", { name: "Add your first endpoint" }),
  ).toBeVisible();

  await authenticatedPage.getByRole("button", { name: "Add endpoint" }).click();
  await authenticatedPage.getByLabel("Endpoint URL").fill(endpoint);
  await authenticatedPage.getByLabel("email.sent").check();
  await authenticatedPage
    .getByRole("button", { name: "Create endpoint" })
    .click();

  await expect(
    authenticatedPage.getByText("Webhook endpoint created"),
  ).toBeVisible();
  await expect(authenticatedPage.getByText(/^whsec_/)).toBeVisible();

  const created = await e2eDb.query<{
    id: string;
    user_id: string;
    event_types: string[];
    signing_secret_enc: string | null;
  }>(
    `select id, user_id, event_types, signing_secret_enc
     from webhooks
     where url = $1`,
    [endpoint],
  );

  expect(created.rowCount).toBe(1);
  expect(created.rows[0]?.user_id).toBe(e2eUser.id);
  expect(created.rows[0]?.event_types).toEqual(["email.sent"]);
  expect(created.rows[0]?.signing_secret_enc).toMatch(/^v1\./);

  await authenticatedPage
    .getByRole("button", { name: "View endpoint" })
    .click();
  await expect(authenticatedPage).toHaveURL(
    new RegExp(`/webhooks/${created.rows[0]?.id}$`),
  );
});
