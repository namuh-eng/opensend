import { createE2ETenant, expect, getE2EBaseUrl, test } from "./fixtures/auth";

test.describe("POST /api/suppressions", () => {
  test("rejects unauthenticated create requests with HTTP 401", async ({
    playwright,
  }) => {
    const request = await playwright.request.newContext({
      baseURL: getE2EBaseUrl(),
    });

    try {
      const res = await request.post("/api/suppressions", {
        data: { email: "anon@test.com" },
      });
      expect(res.status()).toBe(401);
    } finally {
      await request.dispose();
    }
  });

  test("creates, lists, and deletes a manual suppression with API-key auth", async ({
    e2eApiRequest,
    e2eRunId,
  }) => {
    const email = `suppressed-${e2eRunId}@${e2eRunId}.e2e.opensend.test`;

    const createRes = await e2eApiRequest.post("/api/suppressions", {
      data: { email },
    });
    expect(createRes.status()).toBe(201);
    const created = (await createRes.json()) as {
      object: string;
      id: string;
      email: string;
      reason: string;
      scope: string;
    };
    expect(created).toMatchObject({
      object: "suppression",
      email: email.toLowerCase(),
      reason: "manual",
      scope: "user",
    });
    expect(typeof created.id).toBe("string");

    const listRes = await e2eApiRequest.get("/api/suppressions?limit=100");
    expect(listRes.status()).toBe(200);
    const listed = (await listRes.json()) as {
      object: string;
      data: Array<{ id: string; email: string }>;
    };
    expect(listed.object).toBe("list");
    expect(listed.data.some((s) => s.email === email.toLowerCase())).toBe(true);

    const dupRes = await e2eApiRequest.post("/api/suppressions", {
      data: { email },
    });
    expect(dupRes.status()).toBe(201);

    const deleteRes = await e2eApiRequest.delete(
      `/api/suppressions/${encodeURIComponent(email)}`,
    );
    expect(deleteRes.status()).toBe(200);
    await expect(deleteRes.json()).resolves.toEqual({
      object: "suppression",
      deleted: true,
    });
  });

  test("rejects an invalid email body with HTTP 422", async ({
    e2eApiRequest,
  }) => {
    const res = await e2eApiRequest.post("/api/suppressions", {
      data: { email: "not-an-email" },
    });
    expect(res.status()).toBe(422);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("Validation failed");
  });
});

test("suppression API bulk management is tenant-scoped and bounded", async ({
  e2eApiRequest,
  e2eDb,
  e2eRunId,
  playwright,
}) => {
  const tenantB = await createE2ETenant(e2eDb, e2eRunId, "secondary");
  const tenantBRequest = await playwright.request.newContext({
    baseURL: getE2EBaseUrl(),
    extraHTTPHeaders: { Authorization: tenantB.apiKey.authorization },
  });

  const tenantAEmail = `tenant-a-${e2eRunId}@${e2eRunId}.e2e.opensend.test`;
  const tenantBEmail = `tenant-b-${e2eRunId}@${e2eRunId}.e2e.opensend.test`;
  const sanitizedEmail = `+formula-${e2eRunId}@${e2eRunId}.e2e.opensend.test`;

  try {
    const tenantACreate = await e2eApiRequest.post("/api/suppressions", {
      data: { email: tenantAEmail, reason: "manual" },
    });
    expect(tenantACreate.status()).toBe(201);
    const tenantBCreate = await tenantBRequest.post("/api/suppressions", {
      data: { email: tenantBEmail, reason: "manual" },
    });
    expect(tenantBCreate.status()).toBe(201);

    const tenantAList = await e2eApiRequest.get("/api/suppressions?limit=100");
    const tenantABody = (await tenantAList.json()) as {
      data: Array<{ email: string }>;
    };
    expect(tenantABody.data.some((row) => row.email === tenantAEmail)).toBe(
      true,
    );
    expect(tenantABody.data.some((row) => row.email === tenantBEmail)).toBe(
      false,
    );

    const crossDelete = await tenantBRequest.delete(
      `/api/suppressions/${encodeURIComponent(tenantAEmail)}`,
    );
    expect(crossDelete.status()).toBe(404);

    const malformedImport = await e2eApiRequest.post(
      "/api/suppressions/import",
      {
        headers: { "Content-Type": "text/csv" },
        data: "email,reason\nnot-an-email,manual\nvalid@example.com,badreason",
      },
    );
    expect(malformedImport.status()).toBe(422);
    const malformedBody = (await malformedImport.json()) as {
      imported_count: number;
      errors: Array<{ row: number; field: string; message: string }>;
    };
    expect(malformedBody.imported_count).toBe(0);
    expect(malformedBody.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ row: 2, field: "email" }),
        expect.objectContaining({ row: 3, field: "reason" }),
      ]),
    );

    const tenantBImport = await tenantBRequest.post(
      "/api/suppressions/import",
      {
        headers: { "Content-Type": "text/csv" },
        data: `email,reason\nimported-b-${e2eRunId}@${e2eRunId}.e2e.opensend.test,manual`,
      },
    );
    expect(tenantBImport.status()).toBe(201);

    const sanitizedImport = await e2eApiRequest.post(
      "/api/suppressions/import",
      {
        headers: { "Content-Type": "text/csv" },
        data: `email,reason\n${sanitizedEmail},manual`,
      },
    );
    expect(sanitizedImport.status()).toBe(201);

    const tenantAExport = await e2eApiRequest.get("/api/suppressions/export");
    expect(tenantAExport.status()).toBe(200);
    expect(tenantAExport.headers()["x-opensend-export-rows"]).toBeTruthy();
    const tenantACsv = await tenantAExport.text();
    expect(tenantACsv).toContain(tenantAEmail);
    expect(tenantACsv).toContain(`'${sanitizedEmail}`);
    expect(tenantACsv).not.toContain(tenantBEmail);
    expect(tenantACsv).not.toContain(`imported-b-${e2eRunId}`);
  } finally {
    await tenantBRequest.dispose();
  }
});

test("dashboard suppressions page supports session list/create/delete/import/export", async ({
  authenticatedPage,
  e2eRunId,
}) => {
  const manualEmail = `dashboard-manual-${e2eRunId}@${e2eRunId}.e2e.opensend.test`;
  const importedEmail = `dashboard-imported-${e2eRunId}@${e2eRunId}.e2e.opensend.test`;

  await authenticatedPage.goto("/suppressions");
  await expect(
    authenticatedPage.getByRole("heading", { name: "Suppressions" }),
  ).toBeVisible();

  await authenticatedPage
    .getByRole("button", { name: "Add suppression" })
    .click();
  await authenticatedPage.getByLabel("Email").fill(manualEmail);
  await authenticatedPage
    .getByRole("button", { name: "Add suppression" })
    .last()
    .click();
  await expect(authenticatedPage.getByText(manualEmail)).toBeVisible();

  await authenticatedPage.getByRole("button", { name: "Import CSV" }).click();
  await authenticatedPage
    .getByLabel("Suppression CSV")
    .fill(`email,reason\n${importedEmail},manual`);
  await authenticatedPage
    .getByRole("button", { name: "Import CSV" })
    .last()
    .click();
  await expect(
    authenticatedPage.getByText("Imported 1 suppression row."),
  ).toBeVisible();
  await authenticatedPage.getByRole("button", { name: "Cancel" }).click();
  await expect(authenticatedPage.getByText(importedEmail)).toBeVisible();

  const download = await Promise.all([
    authenticatedPage.waitForEvent("download"),
    authenticatedPage.getByRole("button", { name: "Export CSV" }).click(),
  ]).then(([event]) => event);
  const stream = await download.createReadStream();
  if (!stream) throw new Error("Expected dashboard export download stream");
  const csv = await new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (chunk: Buffer) => chunks.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    stream.on("error", reject);
  });
  expect(csv).toContain(manualEmail);
  expect(csv).toContain(importedEmail);

  const row = authenticatedPage.locator("tr", { hasText: manualEmail });
  await row.getByRole("button", { name: "More actions" }).click();
  await authenticatedPage
    .getByRole("button", { name: "Delete suppression" })
    .click();
  await authenticatedPage
    .getByRole("button", { name: "Delete suppression" })
    .last()
    .click();
  await expect(authenticatedPage.getByText(manualEmail)).toHaveCount(0);
});
