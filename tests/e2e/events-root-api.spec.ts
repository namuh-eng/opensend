import { createE2ETenant, expect, getE2EBaseUrl, test } from "./fixtures/auth";

test.describe("Resend-compatible /events root API", () => {
  test("creates, lists, retrieves, updates, deletes, and sends custom events with tenant isolation", async ({
    e2eApiRequest,
    e2eDb,
    e2eRunId,
    e2eTenant,
    playwright,
  }) => {
    const eventName = `user.${e2eRunId.replaceAll("-", ".")}.signed_up`;
    const updatedName = `${eventName}.activated`;
    const schema = {
      type: "object",
      required: ["plan"],
      properties: { plan: { type: "string" } },
    };

    const createResponse = await e2eApiRequest.post("/events", {
      data: { name: eventName, schema },
    });
    expect(createResponse.status()).toBe(201);
    const created = (await createResponse.json()) as {
      object: string;
      id: string;
      name: string;
      schema: typeof schema;
    };
    expect(created).toEqual({
      object: "event",
      id: expect.any(String),
      name: eventName,
      schema,
      created_at: expect.any(String),
      updated_at: expect.any(String),
    });

    const stored = await e2eDb.query<{ name: string; user_id: string }>(
      "select name, user_id from custom_events where id = $1",
      [created.id],
    );
    expect(stored.rows).toEqual([
      { name: eventName, user_id: e2eTenant.user.id },
    ]);

    const listResponse = await e2eApiRequest.get("/events?limit=50");
    expect(listResponse.status()).toBe(200);
    const list = (await listResponse.json()) as {
      object: string;
      data: Array<{ id: string; name: string }>;
      has_more: boolean;
    };
    expect(list.object).toBe("list");
    expect(list.data).toContainEqual(
      expect.objectContaining({ id: created.id, name: eventName }),
    );

    const getByNameResponse = await e2eApiRequest.get(
      `/events/${encodeURIComponent(eventName)}`,
    );
    expect(getByNameResponse.status()).toBe(200);
    await expect(getByNameResponse.json()).resolves.toMatchObject({
      object: "event",
      id: created.id,
      name: eventName,
    });

    const getByIdResponse = await e2eApiRequest.get(`/events/${created.id}`);
    expect(getByIdResponse.status()).toBe(200);
    await expect(getByIdResponse.json()).resolves.toMatchObject({
      object: "event",
      id: created.id,
      name: eventName,
    });

    const otherTenant = await createE2ETenant(e2eDb, e2eRunId, "secondary");
    const otherRequest = await playwright.request.newContext({
      baseURL: getE2EBaseUrl(),
      extraHTTPHeaders: {
        Authorization: otherTenant.apiKey.authorization,
      },
    });

    try {
      const crossTenantGet = await otherRequest.get(`/events/${created.id}`);
      expect(crossTenantGet.status()).toBe(404);

      const crossTenantPatch = await otherRequest.patch(
        `/events/${created.id}`,
        {
          data: { name: `${eventName}.blocked` },
        },
      );
      expect(crossTenantPatch.status()).toBe(404);

      const crossTenantDelete = await otherRequest.delete(
        `/events/${created.id}`,
      );
      expect(crossTenantDelete.status()).toBe(404);
    } finally {
      await otherRequest.dispose();
    }

    const updateResponse = await e2eApiRequest.patch(
      `/events/${encodeURIComponent(eventName)}`,
      { data: { name: updatedName } },
    );
    expect(updateResponse.status()).toBe(200);
    await expect(updateResponse.json()).resolves.toMatchObject({
      object: "event",
      id: created.id,
      name: updatedName,
    });

    const sendResponse = await e2eApiRequest.post("/events/send", {
      data: {
        event: updatedName,
        email: `${e2eRunId}@events.e2e.opensend.test`,
        payload: { plan: "pro" },
      },
    });
    expect(sendResponse.status()).toBe(202);
    const sent = (await sendResponse.json()) as {
      object: string;
      delivery: { id: string; event: string; payload: { plan: string } };
    };
    expect(sent).toMatchObject({
      object: "event_delivery",
      delivery: { event: updatedName, payload: { plan: "pro" } },
    });

    const deliveryRows = await e2eDb.query<{
      user_id: string;
      event_name: string;
    }>(
      "select user_id, event_name from custom_event_deliveries where id = $1",
      [sent.delivery.id],
    );
    expect(deliveryRows.rows).toEqual([
      { user_id: e2eTenant.user.id, event_name: updatedName },
    ]);

    const deleteResponse = await e2eApiRequest.delete(`/events/${created.id}`);
    expect(deleteResponse.status()).toBe(200);
    await expect(deleteResponse.json()).resolves.toEqual({
      object: "event",
      id: created.id,
      deleted: true,
    });

    const deletedGet = await e2eApiRequest.get(`/events/${created.id}`);
    expect(deletedGet.status()).toBe(404);
  });
});
