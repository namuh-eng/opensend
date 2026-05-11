import { createE2ETenant, expect, test } from "./fixtures/auth";

test("audit log shows same-tenant dashboard mutations and hides other tenants", async ({
  authenticatedPage: page,
  e2eDb,
  e2eRunId,
}) => {
  test.skip(
    !process.env.DATABASE_URL,
    "DATABASE_URL is required for audit log tenant isolation proof",
  );

  const otherTenant = await createE2ETenant(e2eDb, e2eRunId, "secondary");
  const runSuffix = e2eRunId.slice(0, 24);
  const primaryKeyName = `audit-visible-${runSuffix}`;
  const otherKeyName = `audit-hidden-${runSuffix}`;

  await e2eDb.query(
    `insert into audit_events
       (user_id, actor_type, actor_id, actor_email, action, target_type, target_id, source, metadata)
     values ($1, 'user', $1, $2, 'api_key.created', 'api_key', $3, 'dashboard', $4::jsonb)`,
    [
      otherTenant.user.id,
      otherTenant.user.email,
      `other-target-${e2eRunId}`,
      JSON.stringify({ name: otherKeyName }),
    ],
  );

  await page.goto("/api-keys");
  await expect(page).not.toHaveURL(/\/auth$/);

  const createResponse = await page.evaluate(async (name) => {
    const response = await fetch("/api/api-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    return { status: response.status, body: await response.json() };
  }, primaryKeyName);

  expect(createResponse.status).toBe(201);
  expect(JSON.stringify(createResponse.body)).toContain("token");

  const auditRows = await e2eDb.query<{
    action: string;
    source: string;
    actor_type: string;
    metadata: { name?: string; token?: string; tokenHash?: string } | null;
  }>(
    `select action, source, actor_type, metadata
     from audit_events
     where user_id like $1 and action = 'api_key.created'
     order by created_at desc`,
    [`e2e-user-${e2eRunId}-primary%`],
  );
  expect(auditRows.rowCount).toBeGreaterThan(0);
  expect(auditRows.rows[0]).toMatchObject({
    action: "api_key.created",
    source: "dashboard",
    actor_type: "user",
  });
  expect(auditRows.rows[0]?.metadata?.name).toBe(primaryKeyName);
  expect(JSON.stringify(auditRows.rows[0]?.metadata)).not.toContain("re_");
  expect(JSON.stringify(auditRows.rows[0]?.metadata)).not.toContain(
    "tokenHash",
  );

  await page.goto(`/audit-log?q=${encodeURIComponent(primaryKeyName)}`);
  await expect(page.getByRole("heading", { name: "Audit Log" })).toBeVisible();
  await expect(
    page.locator("tbody").getByText("api_key.created"),
  ).toBeVisible();
  await expect(page.locator("tbody").getByText(primaryKeyName)).toBeVisible();

  await page.goto(`/audit-log?q=${encodeURIComponent(otherKeyName)}`);
  await expect(page.getByText("No audit events found")).toBeVisible();
  await expect(page.getByText(otherKeyName)).toHaveCount(0);
});
