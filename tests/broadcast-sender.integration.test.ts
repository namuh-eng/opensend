import { randomUUID } from "node:crypto";
import { processScheduledBroadcasts } from "@/lib/workers/broadcast-sender";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const databaseUrl = process.env.DATABASE_URL;
const describeIfDb = databaseUrl ? describe : describe.skip;

async function cleanup(client: Client, marker: string): Promise<void> {
  await client.query("delete from emails where user_id like $1", [
    `${marker}%`,
  ]);
  await client.query("delete from broadcasts where user_id like $1", [
    `${marker}%`,
  ]);
  await client.query("delete from broadcasts where name like $1", [
    `${marker}%`,
  ]);
  await client.query("delete from contacts where user_id like $1", [
    `${marker}%`,
  ]);
  await client.query("delete from segments where user_id like $1", [
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

describeIfDb("broadcast sender tenant isolation", () => {
  const marker = `it-broadcast-${randomUUID()}`;
  const tenantA = `${marker}-tenant-a`;
  const tenantB = `${marker}-tenant-b`;
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
  });

  afterAll(async () => {
    await cleanup(client, marker);
    await client.end();
  });

  it("fans out only to contacts owned by the broadcast tenant when segment names collide", async () => {
    const segmentA = randomUUID();
    const segmentB = randomUUID();
    const contactA = randomUUID();
    const contactB = randomUUID();
    const broadcastId = randomUUID();

    await client.query(
      "insert into segments (id, name, user_id) values ($1, 'vip', $2), ($3, 'vip', $4)",
      [segmentA, tenantA, segmentB, tenantB],
    );
    await client.query(
      "insert into contacts (id, email, first_name, unsubscribed, segments, user_id) values ($1, $2, 'Ada', false, $3::jsonb, $4), ($5, $6, 'Grace', false, $7::jsonb, $8)",
      [
        contactA,
        `${marker}-a@example.test`,
        JSON.stringify(["vip"]),
        tenantA,
        contactB,
        `${marker}-b@example.test`,
        JSON.stringify(["vip"]),
        tenantB,
      ],
    );
    await client.query(
      "insert into broadcasts (id, name, status, audience_id, subject, html, scheduled_at, user_id) values ($1, 'Launch', 'queued', $2, 'Hello {{FIRST_NAME}}', '<p>Hello {{EMAIL}}</p>', now() - interval '1 minute', $3)",
      [broadcastId, segmentA, tenantA],
    );

    await expect(processScheduledBroadcasts()).resolves.toMatchObject({
      processed: 1,
    });

    const created = await client.query<{
      to: string[];
      subject: string;
      user_id: string;
    }>(
      'select "to", subject, user_id from emails where user_id = $1 and tags @> $2::jsonb order by created_at asc',
      [tenantA, JSON.stringify([{ name: "broadcast_id", value: broadcastId }])],
    );

    expect(created.rows).toHaveLength(1);
    expect(created.rows[0]).toMatchObject({
      to: [`${marker}-a@example.test`],
      subject: "Hello Ada",
      user_id: tenantA,
    });
  });

  it("fails ownerless queued broadcasts instead of marking them sent", async () => {
    const broadcastId = randomUUID();
    await client.query(
      "insert into broadcasts (id, name, status, subject, html, scheduled_at, user_id) values ($1, $2, 'queued', 'Owner missing', '<p>Hello</p>', now() - interval '1 minute', null)",
      [broadcastId, `${marker}-ownerless`],
    );

    await expect(processScheduledBroadcasts()).resolves.toMatchObject({
      processed: 1,
    });

    const broadcast = await client.query<{ status: string }>(
      "select status from broadcasts where id = $1",
      [broadcastId],
    );
    expect(broadcast.rows[0]?.status).toBe("failed");

    const emails = await client.query<{ count: string }>(
      "select count(*) from emails where tags @> $1::jsonb",
      [JSON.stringify([{ name: "broadcast_id", value: broadcastId }])],
    );
    expect(emails.rows[0]?.count).toBe("0");
  });
});
