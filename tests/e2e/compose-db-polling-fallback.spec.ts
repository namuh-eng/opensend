import { QueueWorker } from "../../packages/ingester/src/queue-worker";
import { expect, test } from "./fixtures/auth";

test("default no-SQS path dispatches queued email through DB-polling fallback", async ({
  e2eApiRequest,
  e2eDb,
  e2eRunId,
  e2eTenant,
}) => {
  const recipient = `delivered+compose-${e2eRunId}@resend.dev`;

  const response = await e2eApiRequest.post("/emails", {
    data: {
      from: "sender@example.com",
      to: recipient,
      subject: "Compose DB polling fallback e2e",
      html: "<p>DB polling fallback proof</p>",
    },
  });

  expect(response.status()).toBe(200);
  const body = (await response.json()) as { id: string };
  expect(body.id).toBeTruthy();

  await e2eDb.query("update emails set created_at = $1 where id = $2", [
    "2000-01-01T00:00:00.000Z",
    body.id,
  ]);

  const accepted = await e2eDb.query<{ status: string; user_id: string }>(
    "select status, user_id from emails where id = $1",
    [body.id],
  );
  expect(accepted.rows).toEqual([
    { status: "queued", user_id: e2eTenant.user.id },
  ]);

  // Deterministic proof: this uses the real ingester QueueWorker and Postgres,
  // with no SQS queue URL. The resend.dev sandbox recipient exercises the
  // existing worker lifecycle without making a live SES network send.
  const worker = new QueueWorker({ queueUrl: null, dbPollingBatchSize: 1 });
  await expect(worker.pollDatabaseOnce(1)).resolves.toEqual({
    scanned: 1,
    processed: 1,
    errors: 0,
  });

  const delivered = await e2eDb.query<{
    status: string;
    sent_at: Date | null;
    event_types: string[];
  }>(
    `select e.status,
            e.sent_at,
            coalesce(array_agg(ev.type order by ev.type) filter (where ev.id is not null), '{}') as event_types
       from emails e
       left join email_events ev on ev.email_id = e.id
      where e.id = $1 and e.user_id = $2
      group by e.id`,
    [body.id, e2eTenant.user.id],
  );

  // The resend.dev sandbox recipient simulates the provider delivery callback,
  // so the final persisted status advances past sent to delivered.
  expect(delivered.rows[0]?.status).toBe("delivered");
  expect(delivered.rows[0]?.sent_at).not.toBeNull();
  expect(delivered.rows[0]?.event_types).toEqual(
    expect.arrayContaining(["delivered", "sent"]),
  );
});
