import { randomUUID } from "node:crypto";
import { createCustomEventService } from "@opensend/core";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const databaseUrl = process.env.DATABASE_URL;
const describeIfDb = databaseUrl ? describe : describe.skip;

async function cleanup(client: Client, marker: string): Promise<void> {
  await client.query("delete from automation_runs where user_id like $1", [
    `${marker}%`,
  ]);
  await client.query(
    "delete from custom_event_deliveries where user_id like $1",
    [`${marker}%`],
  );
  await client.query("delete from custom_events where user_id like $1", [
    `${marker}%`,
  ]);
  await client.query("delete from contacts where user_id like $1", [
    `${marker}%`,
  ]);
  await client.query('delete from "session" where user_id like $1', [
    `${marker}%`,
  ]);
  await client.query('delete from "account" where user_id like $1', [
    `${marker}%`,
  ]);
  await client.query('delete from "user" where id like $1', [`${marker}%`]);
}

describeIfDb("custom event contact tenant isolation", () => {
  const marker = `it-events-${randomUUID()}`;
  const tenantA = `${marker}-tenant-a`;
  const tenantB = `${marker}-tenant-b`;
  const contactB = randomUUID();
  const client = new Client({ connectionString: databaseUrl });

  beforeAll(async () => {
    await client.connect();
    await cleanup(client, marker);
    await client.query(
      'insert into "user" (id, name, email, email_verified, created_at, updated_at) values ($1, $2, $3, true, now(), now()), ($4, $5, $6, true, now(), now())',
      [
        tenantA,
        "Tenant A",
        `${tenantA}@example.test`,
        tenantB,
        "Tenant B",
        `${tenantB}@example.test`,
      ],
    );
    await client.query(
      "insert into contacts (id, email, first_name, unsubscribed, user_id) values ($1, $2, 'Grace', false, $3)",
      [contactB, `${marker}-foreign@example.test`, tenantB],
    );
    await client.query(
      "insert into custom_events (name, schema, user_id) values ('user.signed_up', null, $1)",
      [tenantA],
    );
  });

  afterAll(async () => {
    await cleanup(client, marker);
    await client.end();
  });

  it("does not attach another tenant's contact id to a custom event delivery", async () => {
    const service = createCustomEventService();

    const result = await service.sendCustomEvent({
      userId: tenantA,
      data: {
        event: "user.signed_up",
        contact_id: contactB,
        payload: { plan: "pro" },
      },
    });

    expect(result.delivery).toMatchObject({
      event: "user.signed_up",
      contact_id: null,
    });

    const delivery = await client.query<{ contact_id: string | null }>(
      "select contact_id from custom_event_deliveries where user_id = $1 and event_name = 'user.signed_up' order by received_at desc limit 1",
      [tenantA],
    );
    expect(delivery.rows[0]?.contact_id).toBeNull();
  });
});
