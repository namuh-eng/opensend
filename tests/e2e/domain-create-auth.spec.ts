import { expect, test } from "./fixtures/auth";

test("dashboard user can add a domain with session auth", async ({
  authenticatedPage,
  e2eDb,
  e2eUser,
}) => {
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const domainName = `domain-create-${runId}.example.com`;

  try {
    await authenticatedPage.goto("/domains");
    await expect(
      authenticatedPage.getByRole("heading", { name: "Domains" }),
    ).toBeVisible();

    await authenticatedPage.getByRole("button", { name: "Add domain" }).click();
    await authenticatedPage.getByPlaceholder("yourdomain.com").fill(domainName);
    await authenticatedPage
      .getByRole("button", { name: "Add", exact: true })
      .click();

    await expect(authenticatedPage).toHaveURL(/\/domains\//, {
      timeout: 15_000,
    });
    await expect(
      authenticatedPage.getByRole("heading", { name: domainName }),
    ).toBeVisible();

    const { rows } = await e2eDb.query<{ user_id: string }>(
      "select user_id from domains where name = $1",
      [domainName],
    );
    expect(rows).toEqual([{ user_id: e2eUser.id }]);
  } finally {
    await e2eDb.query("delete from domains where name = $1", [domainName]);
  }
});
