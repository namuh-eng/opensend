import {
  cleanupE2ERun,
  createE2ETenant,
  expect,
  getE2EBaseUrl,
  test,
} from "./fixtures/auth";

test("contact API routes isolate tenant-owned list, detail, mutation, and delete access", async ({
  e2eDb,
  e2eRunId,
  playwright,
}) => {
  await cleanupE2ERun(e2eDb, e2eRunId);

  const tenantA = await createE2ETenant(e2eDb, e2eRunId, "tenant-a");
  const tenantB = await createE2ETenant(e2eDb, e2eRunId, "tenant-b");
  const tenantARequest = await playwright.request.newContext({
    baseURL: getE2EBaseUrl(),
    extraHTTPHeaders: { Authorization: tenantA.apiKey.authorization },
  });
  const tenantBRequest = await playwright.request.newContext({
    baseURL: getE2EBaseUrl(),
    extraHTTPHeaders: { Authorization: tenantB.apiKey.authorization },
  });

  try {
    const createA = await tenantARequest.post("/api/contacts", {
      data: {
        email: `tenant-a-contact@${e2eRunId}.e2e.opensend.test`,
        first_name: "Tenant",
        last_name: "A",
        properties: { test_run_id: e2eRunId },
      },
    });
    expect(createA.status()).toBe(201);
    const createdA = (await createA.json()) as { id: string };
    expect(createdA.id).toBeTruthy();

    const createB = await tenantBRequest.post("/api/contacts", {
      data: {
        email: `tenant-b-contact@${e2eRunId}.e2e.opensend.test`,
        first_name: "Tenant",
        last_name: "B",
        properties: { test_run_id: e2eRunId },
      },
    });
    expect(createB.status()).toBe(201);
    const createdB = (await createB.json()) as { id: string };
    expect(createdB.id).toBeTruthy();

    const listB = await tenantBRequest.get("/api/contacts", {
      params: { search: e2eRunId, limit: "20" },
    });
    expect(listB.status()).toBe(200);
    const tenantBList = (await listB.json()) as {
      data: Array<{ id: string; email: string }>;
    };
    expect(tenantBList.data.map((contact) => contact.id)).toContain(
      createdB.id,
    );
    expect(tenantBList.data.map((contact) => contact.id)).not.toContain(
      createdA.id,
    );

    const crossTenantDetail = await tenantBRequest.get(
      `/api/contacts/${createdA.id}`,
    );
    expect(crossTenantDetail.status()).toBe(404);

    const crossTenantMutation = await tenantBRequest.patch(
      `/api/contacts/${createdA.id}`,
      { data: { first_name: "Compromised" } },
    );
    expect(crossTenantMutation.status()).toBe(404);

    const { rows: afterPatchRows } = await e2eDb.query<{ first_name: string }>(
      "select first_name from contacts where id = $1",
      [createdA.id],
    );
    expect(afterPatchRows).toEqual([{ first_name: "Tenant" }]);

    const crossTenantDelete = await tenantBRequest.delete(
      `/api/contacts/${createdA.id}`,
    );
    expect(crossTenantDelete.status()).toBe(404);

    const { rows: afterDeleteRows } = await e2eDb.query<{ id: string }>(
      "select id from contacts where id = $1",
      [createdA.id],
    );
    expect(afterDeleteRows).toEqual([{ id: createdA.id }]);
  } finally {
    await tenantARequest.dispose();
    await tenantBRequest.dispose();
    await cleanupE2ERun(e2eDb, e2eRunId);
  }
});
