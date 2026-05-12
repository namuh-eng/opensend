import { createE2ETenant, expect, getE2EBaseUrl, test } from "./fixtures/auth";

test.describe("Resend-compatible /api-keys root API", () => {
  test("creates, lists, and deletes through root aliases while preserving dashboard navigation and tenant isolation", async ({
    authenticatedPage: page,
    e2eApiRequest,
    e2eDb,
    e2eRunId,
    e2eTenant,
    playwright,
  }) => {
    await page.goto("/api-keys");
    await expect(
      page.getByRole("heading", { name: "API Keys", exact: true }),
    ).toBeVisible();

    const name = `root-${e2eRunId.slice(0, 32)}`;
    const createResponse = await e2eApiRequest.post("/api-keys", {
      data: { name, permission: "full_access" },
    });
    expect(createResponse.status()).toBe(201);
    const created = (await createResponse.json()) as {
      id: string;
      token: string;
    };
    expect(created).toEqual({
      id: expect.any(String),
      token: expect.any(String),
    });

    const createdRows = await e2eDb.query<{
      name: string;
      user_id: string;
    }>("select name, user_id from api_keys where id = $1", [created.id]);
    expect(createdRows.rows).toEqual([{ name, user_id: e2eTenant.user.id }]);

    const listResponse = await e2eApiRequest.get("/api-keys?limit=100");
    expect(listResponse.status()).toBe(200);
    const listed = (await listResponse.json()) as {
      object: string;
      data: Array<{ id: string; name: string; permission: string }>;
      has_more: boolean;
    };
    expect(listed.object).toBe("list");
    expect(listed.data).toContainEqual(
      expect.objectContaining({
        id: created.id,
        name,
        permission: "full_access",
      }),
    );
    expect(JSON.stringify(listed)).not.toContain(created.token);

    const otherTenant = await createE2ETenant(e2eDb, e2eRunId, "secondary");
    const otherRequest = await playwright.request.newContext({
      baseURL: getE2EBaseUrl(),
      extraHTTPHeaders: {
        Authorization: otherTenant.apiKey.authorization,
      },
    });

    try {
      const isolatedListResponse = await otherRequest.get(
        "/api-keys?limit=100",
      );
      expect(isolatedListResponse.status()).toBe(200);
      const isolatedList = (await isolatedListResponse.json()) as {
        data: Array<{ id: string }>;
      };
      expect(isolatedList.data.some((key) => key.id === created.id)).toBe(
        false,
      );

      const crossTenantDelete = await otherRequest.delete(
        `/api-keys/${created.id}`,
      );
      expect(crossTenantDelete.status()).toBe(404);
      await expect(crossTenantDelete.json()).resolves.toEqual({
        error: "API key not found",
      });
    } finally {
      await otherRequest.dispose();
    }

    const deleteResponse = await e2eApiRequest.delete(
      `/api-keys/${created.id}`,
    );
    expect(deleteResponse.status()).toBe(200);
    await expect(deleteResponse.text()).resolves.toBe("");

    const remainingRows = await e2eDb.query<{ count: string }>(
      "select count(*)::text as count from api_keys where id = $1",
      [created.id],
    );
    expect(remainingRows.rows[0]?.count).toBe("0");
  });
});
