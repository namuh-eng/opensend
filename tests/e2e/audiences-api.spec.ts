import { expect, test } from "./fixtures/auth";

test.describe("Resend-compatible /audiences API", () => {
  test("creates, lists, retrieves, and deletes an audience through segment storage", async ({
    e2eApiRequest,
    e2eDb,
    e2eRunId,
    e2eTenant,
  }) => {
    const name = `Registered Users ${e2eRunId}`;

    const createResponse = await e2eApiRequest.post("/audiences", {
      data: { name },
    });
    expect(createResponse.status()).toBe(201);
    const created = (await createResponse.json()) as {
      object: string;
      id: string;
      name: string;
    };
    expect(created).toEqual({
      object: "audience",
      id: expect.any(String),
      name,
    });

    const segmentRows = await e2eDb.query<{
      name: string;
      user_id: string;
    }>("select name, user_id from segments where id = $1", [created.id]);
    expect(segmentRows.rows).toEqual([{ name, user_id: e2eTenant.user.id }]);

    const listResponse = await e2eApiRequest.get(
      `/audiences?search=${encodeURIComponent(name)}&limit=10`,
    );
    expect(listResponse.status()).toBe(200);
    const listed = (await listResponse.json()) as {
      object: string;
      has_more: boolean;
      data: Array<{ id: string; name: string; created_at: string }>;
      total?: number;
    };
    expect(listed).toEqual({
      object: "list",
      has_more: false,
      data: [
        {
          id: created.id,
          name,
          created_at: expect.any(String),
        },
      ],
    });
    expect(listed.total).toBeUndefined();

    const getResponse = await e2eApiRequest.get(`/audiences/${created.id}`);
    expect(getResponse.status()).toBe(200);
    await expect(getResponse.json()).resolves.toEqual({
      object: "audience",
      id: created.id,
      name,
      created_at: expect.any(String),
    });

    const deleteResponse = await e2eApiRequest.delete(
      `/audiences/${created.id}`,
    );
    expect(deleteResponse.status()).toBe(200);
    await expect(deleteResponse.json()).resolves.toEqual({
      object: "audience",
      id: created.id,
      deleted: true,
    });

    const deletedGetResponse = await e2eApiRequest.get(
      `/audiences/${created.id}`,
    );
    expect(deletedGetResponse.status()).toBe(404);
  });
});
