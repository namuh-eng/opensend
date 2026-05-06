import { createHmac } from "node:crypto";
import { expect, test } from "@playwright/test";
import { Client } from "pg";

function requireDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for domain create E2E");
  }
  return databaseUrl;
}

function signBetterAuthSessionToken(sessionToken: string): string {
  const secret =
    process.env.BETTER_AUTH_SECRET ?? "better-auth-secret-12345678901234567890";
  const signature = createHmac("sha256", secret)
    .update(sessionToken)
    .digest("base64");
  return `${sessionToken}.${signature}`;
}

test("dashboard user can add a domain with session auth", async ({
  context,
  page,
}) => {
  test.skip(!process.env.DATABASE_URL, "DATABASE_URL is required");

  const runId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const userId = `domain-create-e2e-user-${runId}`;
  const sessionToken = `domain-create-e2e-session-${runId}`;
  const sessionId = `domain-create-e2e-session-id-${runId}`;
  const domainName = `domain-create-${runId}.example.com`;
  const client = new Client({ connectionString: requireDatabaseUrl() });

  await client.connect();
  try {
    await client.query(
      `insert into "user" (id, name, email, email_verified, created_at, updated_at)
       values ($1, $2, $3, true, now(), now())
       on conflict (id) do update set updated_at = now()`,
      [userId, "Domain Create E2E", `${userId}@example.com`],
    );
    await client.query(
      `insert into "session" (id, token, user_id, expires_at, created_at, updated_at)
       values ($1, $2, $3, now() + interval '1 hour', now(), now())
       on conflict (token) do update set expires_at = excluded.expires_at`,
      [sessionId, sessionToken, userId],
    );

    await context.addCookies([
      {
        name: "better-auth.session_token",
        value: signBetterAuthSessionToken(sessionToken),
        domain: "localhost",
        path: "/",
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);

    await page.goto("/domains");
    await expect(page.getByRole("heading", { name: "Domains" })).toBeVisible();

    await page.getByRole("button", { name: "Add domain" }).click();
    await page.getByPlaceholder("yourdomain.com").fill(domainName);
    await page.getByRole("button", { name: "Add", exact: true }).click();

    await expect(page).toHaveURL(/\/domains\//, { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: domainName })).toBeVisible();

    const { rows } = await client.query<{ user_id: string }>(
      "select user_id from domains where name = $1",
      [domainName],
    );
    expect(rows).toEqual([{ user_id: userId }]);
  } finally {
    await client.query("delete from domains where name = $1", [domainName]);
    await client.query('delete from "session" where token = $1', [
      sessionToken,
    ]);
    await client.query('delete from "user" where id = $1', [userId]);
    await client.end();
  }
});
