import { createE2ETenant, expect, test } from "./fixtures/auth";

test.setTimeout(60_000);

test("webhook integration API and dashboard stay tenant scoped", async ({
  authenticatedPage: page,
  e2eApiRequest,
  e2eDb,
  e2eRunId,
  request,
}) => {
  test.skip(
    !process.env.DATABASE_URL,
    "DATABASE_URL is required for integration tenant isolation proof",
  );
  test.skip(
    !(
      process.env.INTEGRATION_SECRET_ENCRYPTION_KEY ||
      process.env.WEBHOOK_SECRET_ENCRYPTION_KEY
    ),
    "INTEGRATION_SECRET_ENCRYPTION_KEY is required for connector credential proof",
  );

  const otherTenant = await createE2ETenant(e2eDb, e2eRunId, "secondary");
  const rawSecretPath = `secret-token-${e2eRunId}`;
  const webhookUrl = `https://example.com/hooks/${e2eRunId}/${rawSecretPath}`;

  const createResponse = await e2eApiRequest.post("/api/integrations/webhook", {
    data: {
      name: `Zapier ${e2eRunId}`,
      webhook_url: webhookUrl,
      signing_secret: `receiver-secret-${e2eRunId}`,
    },
  });
  expect(createResponse.status()).toBe(201);
  const created = (await createResponse.json()) as {
    data: {
      id: string;
      status: string;
      config: { webhook?: { endpointPreview?: string } };
    };
  };
  expect(created.data.status).toBe("connected");
  expect(created.data.config.webhook?.endpointPreview).toBe(
    "https://example.com/hooks/…",
  );
  expect(JSON.stringify(created)).not.toContain(rawSecretPath);
  expect(JSON.stringify(created)).not.toContain("receiver-secret");

  const stored = await e2eDb.query<{
    credentials_enc: string;
    config: { webhook?: { endpointPreview?: string } };
  }>(
    `select credentials_enc, config
       from integration_connections
      where id = $1`,
    [created.data.id],
  );
  expect(stored.rowCount).toBe(1);
  expect(stored.rows[0]?.credentials_enc).not.toContain(rawSecretPath);
  expect(stored.rows[0]?.credentials_enc).not.toContain("receiver-secret");
  expect(stored.rows[0]?.config.webhook?.endpointPreview).toBe(
    "https://example.com/hooks/…",
  );

  const catalogResponse = await e2eApiRequest.get("/api/integrations");
  expect(catalogResponse.status()).toBe(200);
  const catalog = (await catalogResponse.json()) as {
    data: Array<{ provider: string; status: string }>;
  };
  expect(catalog.data).toEqual([
    expect.objectContaining({ provider: "webhook", status: "installed" }),
  ]);

  const otherDetail = await request.get(
    `/api/integrations/connections/${created.data.id}`,
    { headers: { Authorization: otherTenant.apiKey.authorization } },
  );
  expect(otherDetail.status()).toBe(404);

  const otherDisconnect = await request.delete(
    `/api/integrations/connections/${created.data.id}`,
    { headers: { Authorization: otherTenant.apiKey.authorization } },
  );
  expect(otherDisconnect.status()).toBe(404);

  const malformedDetail = await e2eApiRequest.get(
    "/api/integrations/connections/not-a-uuid",
  );
  expect(malformedDetail.status()).toBe(400);

  await page.goto("/integrations");
  await expect(
    page.getByRole("heading", { name: "App integrations" }),
  ).toBeVisible();
  await expect(page.getByText("installed")).toBeVisible();
  await expect(page.getByText("https://example.com/hooks/…")).toBeVisible();

  const updateResponse = await e2eApiRequest.patch(
    `/api/integrations/connections/${created.data.id}`,
    { data: { name: `Renamed ${e2eRunId}` } },
  );
  expect(updateResponse.status()).toBe(200);

  const disconnectResponse = await e2eApiRequest.delete(
    `/api/integrations/connections/${created.data.id}`,
  );
  expect(disconnectResponse.status()).toBe(200);
  const disconnected = (await disconnectResponse.json()) as {
    data: { status: string };
  };
  expect(disconnected.data.status).toBe("disconnected");

  const disconnectedTest = await e2eApiRequest.post(
    `/api/integrations/connections/${created.data.id}/test`,
  );
  expect(disconnectedTest.status()).toBe(422);

  const auditRows = await e2eDb.query<{
    action: string;
    metadata: { endpoint_preview?: string; signing_secret?: string } | null;
  }>(
    `select action, metadata
       from audit_events
      where user_id like $1
        and target_type = 'integration'
      order by created_at asc`,
    [`e2e-user-${e2eRunId}-primary%`],
  );
  expect(auditRows.rows.map((row) => row.action)).toEqual([
    "integration.connected",
    "integration.updated",
    "integration.disconnected",
  ]);
  const serializedAudit = JSON.stringify(auditRows.rows);
  expect(serializedAudit).not.toContain(rawSecretPath);
  expect(serializedAudit).not.toContain("receiver-secret");
});
