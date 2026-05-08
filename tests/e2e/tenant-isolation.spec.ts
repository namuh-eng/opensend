import {
  cleanupE2EApiKey,
  cleanupE2EContactsByEmailPrefix,
  countE2ERowsByPrefix,
  createE2EApiKey,
  expect,
  test,
} from "./fixtures/auth";
import type { E2EApiKey } from "./fixtures/auth";

type ContactCreateResponse = {
  id?: string;
};

type ContactListResponse = {
  data?: Array<{ id?: string; email?: string }>;
};

test("API routes isolate contacts between tenant API keys", async ({
  e2eDb,
  e2eRun,
  e2eTenantA,
  e2eTenantB,
  request,
}) => {
  let tenantAKey: E2EApiKey | null = null;
  let tenantBKey: E2EApiKey | null = null;
  const tenantAEmail = `${e2eRun.emailPrefix}-tenant-a-contact@example.com`;
  let contactId: string | null = null;

  try {
    tenantAKey = await createE2EApiKey(e2eDb, {
      userId: e2eTenantA.id,
      runId: e2eRun.runId,
      label: "tenant-a",
    });
    tenantBKey = await createE2EApiKey(e2eDb, {
      userId: e2eTenantB.id,
      runId: e2eRun.runId,
      label: "tenant-b",
    });

    const createResponse = await request.post("/api/contacts", {
      headers: { Authorization: tenantAKey.authorization },
      data: {
        email: tenantAEmail,
        first_name: "Tenant",
        last_name: "A",
      },
    });
    expect(createResponse.status()).toBe(201);
    const created = (await createResponse.json()) as ContactCreateResponse;
    expect(created.id).toBeTruthy();
    contactId = created.id ?? null;
    if (!contactId) throw new Error("Expected created contact id");

    const ownerReadResponse = await request.get(`/api/contacts/${contactId}`, {
      headers: { Authorization: tenantAKey.authorization },
    });
    expect(ownerReadResponse.status()).toBe(200);
    await expect(ownerReadResponse).toBeOK();

    const crossTenantListResponse = await request.get(
      `/api/contacts?search=${encodeURIComponent(tenantAEmail)}`,
      { headers: { Authorization: tenantBKey.authorization } },
    );
    expect(crossTenantListResponse.status()).toBe(200);
    const crossTenantList =
      (await crossTenantListResponse.json()) as ContactListResponse;
    expect(crossTenantList.data ?? []).toEqual([]);

    const crossTenantReadResponse = await request.get(
      `/api/contacts/${contactId}`,
      { headers: { Authorization: tenantBKey.authorization } },
    );
    expect(crossTenantReadResponse.status()).toBe(404);

    const crossTenantUpdateResponse = await request.patch(
      `/api/contacts/${contactId}`,
      {
        headers: { Authorization: tenantBKey.authorization },
        data: { first_name: "Intruder" },
      },
    );
    expect(crossTenantUpdateResponse.status()).toBe(404);

    const crossTenantDeleteResponse = await request.delete(
      `/api/contacts/${contactId}`,
      { headers: { Authorization: tenantBKey.authorization } },
    );
    expect(crossTenantDeleteResponse.status()).toBe(404);

    const { rows: afterDeleteAttemptRows } = await e2eDb.query<{
      user_id: string;
      first_name: string | null;
    }>("select user_id, first_name from contacts where id = $1", [contactId]);
    expect(afterDeleteAttemptRows).toEqual([
      { user_id: e2eTenantA.id, first_name: "Tenant" },
    ]);
  } finally {
    if (tenantAKey) await cleanupE2EApiKey(e2eDb, tenantAKey);
    if (tenantBKey) await cleanupE2EApiKey(e2eDb, tenantBKey);
    await cleanupE2EContactsByEmailPrefix(e2eDb, e2eRun.emailPrefix);
    expect(await countE2ERowsByPrefix(e2eDb, e2eRun.emailPrefix)).toBe(0);
  }
});
