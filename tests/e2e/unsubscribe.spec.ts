import { createHmac } from "node:crypto";
import { expect, test } from "@playwright/test";
import { Client } from "pg";

function unsubscribeSecret(): string {
  return (
    process.env.UNSUBSCRIBE_SECRET ??
    process.env.BETTER_AUTH_SECRET ??
    process.env.AUTH_SECRET ??
    process.env.DASHBOARD_KEY ??
    "opensend-local-unsubscribe-secret"
  );
}

function unsubscribeToken(contactId: string): string {
  return createHmac("sha256", unsubscribeSecret())
    .update(`opensend.unsubscribe.v1:${contactId}`)
    .digest("base64url");
}

test("public unsubscribe page shows success and persists contact update", async ({
  page,
}) => {
  test.skip(!process.env.DATABASE_URL, "DATABASE_URL is required");

  const contactId = "00000000-0000-4000-8000-000000000173";
  const email = `issue-173-${Date.now()}@example.com`;
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query("delete from contacts where id = $1", [contactId]);
    await client.query(
      "insert into contacts (id, email, unsubscribed) values ($1, $2, false)",
      [contactId, email],
    );

    await page.goto(
      `/unsubscribe/${contactId}?token=${unsubscribeToken(contactId)}`,
    );

    await expect(page.getByTestId("unsubscribe-success")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Unsubscribed successfully" }),
    ).toBeVisible();
    const { rows } = await client.query<{ unsubscribed: boolean }>(
      "select unsubscribed from contacts where id = $1",
      [contactId],
    );
    expect(rows[0]?.unsubscribed).toBe(true);
  } finally {
    await client.query("delete from contacts where id = $1", [contactId]);
    await client.end();
  }
});

test("public unsubscribe page shows error for invalid token", async ({
  page,
}) => {
  await page.goto(
    "/unsubscribe/00000000-0000-4000-8000-000000000173?token=bad",
  );

  await expect(page.getByTestId("unsubscribe-error")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Something went wrong" }),
  ).toBeVisible();
});
