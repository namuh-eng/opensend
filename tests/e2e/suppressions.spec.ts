import { expect, getE2EBaseUrl, test } from "./fixtures/auth";

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

    // Create
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

    // List — the new suppression should appear
    const listRes = await e2eApiRequest.get("/api/suppressions?limit=100");
    expect(listRes.status()).toBe(200);
    const listed = (await listRes.json()) as {
      object: string;
      data: Array<{ id: string; email: string }>;
    };
    expect(listed.object).toBe("list");
    expect(listed.data.some((s) => s.email === email.toLowerCase())).toBe(true);

    // Idempotent — posting again returns 201 without error
    const dupRes = await e2eApiRequest.post("/api/suppressions", {
      data: { email },
    });
    expect(dupRes.status()).toBe(201);

    // Delete
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
