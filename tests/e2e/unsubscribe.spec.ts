import { createHmac } from "node:crypto";
import { expect, test } from "@playwright/test";
import { Client } from "pg";

function unsubscribeSecret(): string {
  return process.env.UNSUBSCRIBE_SECRET ?? "opensend-local-unsubscribe-secret";
}

function unsubscribeToken(contactId: string): string {
  return createHmac("sha256", unsubscribeSecret())
    .update(`opensend.unsubscribe.v1:${contactId}`)
    .digest("base64url");
}

test("public unsubscribe page renders preferences without mutating the contact", async ({
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

    await expect(page.getByTestId("unsubscribe-preferences")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Subscription preferences" }),
    ).toBeVisible();
    const { rows } = await client.query<{ unsubscribed: boolean }>(
      "select unsubscribed from contacts where id = $1",
      [contactId],
    );
    expect(rows[0]?.unsubscribed).toBe(false);
  } finally {
    await client.query("delete from contacts where id = $1", [contactId]);
    await client.end();
  }
});

test("one-click POST globally unsubscribes a signed contact", async ({
  request,
}) => {
  test.skip(!process.env.DATABASE_URL, "DATABASE_URL is required");

  const contactId = "00000000-0000-4000-8000-000000000174";
  const email = `one-click-${Date.now()}@example.com`;
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query("delete from contacts where id = $1", [contactId]);
    await client.query(
      "insert into contacts (id, email, unsubscribed) values ($1, $2, false)",
      [contactId, email],
    );

    const response = await request.post(
      `/unsubscribe/${contactId}?token=${unsubscribeToken(contactId)}`,
      {
        headers: { "content-type": "application/x-www-form-urlencoded" },
        data: "List-Unsubscribe=One-Click",
      },
    );

    expect(response.status()).toBe(202);
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

test("public preference page saves only visible tenant topic selections", async ({
  page,
}) => {
  test.skip(!process.env.DATABASE_URL, "DATABASE_URL is required");

  const tenantId = `unsubscribe-e2e-${Date.now()}`;
  const contactId = "00000000-0000-4000-8000-000000000175";
  const publicTopicId = "00000000-0000-4000-8000-000000000176";
  const privateShownTopicId = "00000000-0000-4000-8000-000000000177";
  const privateHiddenTopicId = "00000000-0000-4000-8000-000000000178";
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query("delete from contacts where id = $1", [contactId]);
    await client.query("delete from topics where user_id = $1", [tenantId]);
    await client.query(
      "insert into contacts (id, email, unsubscribed, topic_subscriptions, user_id) values ($1, $2, false, $3::jsonb, $4)",
      [
        contactId,
        `preferences-${Date.now()}@example.com`,
        JSON.stringify([{ topicId: privateShownTopicId, subscribed: true }]),
        tenantId,
      ],
    );
    await client.query(
      `insert into topics (id, name, description, default_subscription, visibility, user_id)
       values
       ($1, 'Product updates', 'Public product news', 'opt_in', 'public', $4),
       ($2, 'Partners', 'Private partner offers', 'opt_out', 'private', $4),
       ($3, 'Hidden', 'Should not render', 'opt_in', 'private', $4)`,
      [publicTopicId, privateShownTopicId, privateHiddenTopicId, tenantId],
    );

    await page.goto(
      `/unsubscribe/${contactId}?token=${unsubscribeToken(contactId)}&topic_id=${publicTopicId}`,
    );

    await expect(page.getByLabel("Product updates")).toBeVisible();
    await expect(page.getByLabel("Partners")).toBeVisible();
    await expect(page.getByText("Hidden")).toHaveCount(0);

    await page.getByLabel("Product updates").uncheck();
    await page.getByRole("button", { name: "Update preferences" }).click();
    await expect(
      page.getByTestId("unsubscribe-preferences-saved"),
    ).toBeVisible();

    const { rows } = await client.query<{
      topic_subscriptions: Array<{ topicId: string; subscribed: boolean }>;
      unsubscribed: boolean;
    }>("select topic_subscriptions, unsubscribed from contacts where id = $1", [
      contactId,
    ]);
    expect(rows[0]?.unsubscribed).toBe(false);
    expect(rows[0]?.topic_subscriptions).toContainEqual({
      topicId: publicTopicId,
      subscribed: false,
    });
    expect(rows[0]?.topic_subscriptions).toContainEqual({
      topicId: privateShownTopicId,
      subscribed: true,
    });
    expect(rows[0]?.topic_subscriptions).not.toContainEqual({
      topicId: privateHiddenTopicId,
      subscribed: true,
    });
  } finally {
    await client.query("delete from contacts where id = $1", [contactId]);
    await client.query("delete from topics where user_id = $1", [tenantId]);
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
