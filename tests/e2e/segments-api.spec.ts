import { expect, test } from "./fixtures/auth";

test.describe("Resend-compatible /segments API", () => {
  test("creates, lists, retrieves, deletes, and lists segment contacts with API-key auth", async ({
    e2eApiRequest,
    e2eDb,
    e2eRunId,
    e2eTenant,
  }) => {
    const name = `Registered Users ${e2eRunId}`;

    const createResponse = await e2eApiRequest.post("/segments", {
      data: { name },
    });
    expect(createResponse.status()).toBe(201);
    const created = (await createResponse.json()) as {
      object: string;
      id: string;
      name: string;
    };
    expect(created).toEqual({
      object: "segment",
      id: expect.any(String),
      name,
    });

    const segmentRows = await e2eDb.query<{
      name: string;
      user_id: string;
    }>("select name, user_id from segments where id = $1", [created.id]);
    expect(segmentRows.rows).toEqual([{ name, user_id: e2eTenant.user.id }]);

    const contactEmail = `segment-contact-${e2eRunId}@${e2eRunId}.e2e.opensend.test`;
    const contactRows = await e2eDb.query<{ id: string }>(
      `insert into contacts (email, first_name, last_name, user_id, document)
       values ($1, 'Segment', 'Member', $2, $3::jsonb)
       returning id`,
      [
        contactEmail,
        e2eTenant.user.id,
        JSON.stringify({ test_run_id: e2eRunId }),
      ],
    );
    const contactId = contactRows.rows[0]?.id ?? "";
    await e2eDb.query(
      `insert into contacts_to_segments (contact_id, segment_id)
       values ($1, $2)
       on conflict do nothing`,
      [contactId, created.id],
    );

    const listResponse = await e2eApiRequest.get(
      `/segments?search=${encodeURIComponent(name)}&limit=10`,
    );
    expect(listResponse.status()).toBe(200);
    const listed = (await listResponse.json()) as {
      object: string;
      has_more: boolean;
      data: Array<{ id: string; name: string; created_at: string }>;
      total: number;
    };
    expect(listed).toEqual({
      object: "list",
      has_more: false,
      total: 1,
      data: [
        {
          id: created.id,
          name,
          created_at: expect.any(String),
        },
      ],
    });

    const getResponse = await e2eApiRequest.get(`/segments/${created.id}`);
    expect(getResponse.status()).toBe(200);
    await expect(getResponse.json()).resolves.toEqual({
      object: "segment",
      id: created.id,
      name,
      created_at: expect.any(String),
    });

    const contactsResponse = await e2eApiRequest.get(
      `/segments/${created.id}/contacts?limit=10`,
    );
    expect(contactsResponse.status()).toBe(200);
    await expect(contactsResponse.json()).resolves.toEqual({
      object: "list",
      has_more: false,
      data: [
        {
          id: contactId,
          email: contactEmail,
          firstName: "Segment",
          lastName: "Member",
          status: "subscribed",
          created_at: expect.any(String),
        },
      ],
    });

    const deleteResponse = await e2eApiRequest.delete(
      `/segments/${created.id}`,
    );
    expect(deleteResponse.status()).toBe(200);
    await expect(deleteResponse.json()).resolves.toEqual({ success: true });

    const deletedGetResponse = await e2eApiRequest.get(
      `/segments/${created.id}`,
    );
    expect(deletedGetResponse.status()).toBe(404);
  });
});
