import { expect, test } from "./fixtures/auth";

// E2E category: real browser E2E; requires local DKIM_ENCRYPTION_KEY because domain creation generates DKIM keys.
test.skip(
  !process.env.DKIM_ENCRYPTION_KEY,
  "Set DKIM_ENCRYPTION_KEY to run domain creation E2E.",
);

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
    await authenticatedPage.getByText("Advanced options").click();
    await authenticatedPage.getByPlaceholder("links").fill("links");
    await authenticatedPage
      .getByRole("button", { name: "Add", exact: true })
      .click();

    await expect(authenticatedPage).toHaveURL(/\/domains\//, {
      timeout: 15_000,
    });
    await expect(
      authenticatedPage.getByRole("heading", { name: domainName }),
    ).toBeVisible();

    const { rows } = await e2eDb.query<{
      user_id: string;
      tracking_subdomain: string | null;
      records: Array<{ type: string; name: string }> | null;
    }>(
      "select user_id, tracking_subdomain, records from domains where name = $1",
      [domainName],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      user_id: e2eUser.id,
      tracking_subdomain: "links",
    });
    expect(rows[0]?.records ?? []).toContainEqual(
      expect.objectContaining({
        type: "CNAME",
        name: `links.${domainName}`,
      }),
    );
  } finally {
    await e2eDb.query("delete from domains where name = $1", [domainName]);
  }
});
