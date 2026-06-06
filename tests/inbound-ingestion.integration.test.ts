import { randomUUID } from "node:crypto";
import {
  ReceivedEmailServiceError,
  createForwardingRuleService,
  createInboundEmailIngestionService,
  createReceivedEmailService,
  generateReplyToken,
} from "@opensend/core";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import app from "../packages/ingester/src/index";

const databaseUrl = process.env.DATABASE_URL;
const describeIfDb = databaseUrl ? describe : describe.skip;

function buildMime(input: {
  from: string;
  to: string;
  subject: string;
  attachment?: boolean;
}): string {
  if (!input.attachment) {
    return `From: ${input.from}\r\nTo: ${input.to}\r\nSubject: ${input.subject}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\nHello inbound`;
  }

  return `From: ${input.from}\r\nTo: ${input.to}\r\nSubject: ${input.subject}\r\nMessage-ID: <${randomUUID()}@fixture.test>\r\nContent-Type: multipart/mixed; boundary="fixture-boundary"\r\n\r\n--fixture-boundary\r\nContent-Type: text/plain; charset=utf-8\r\n\r\nHello inbound\r\n--fixture-boundary\r\nContent-Type: text/plain; name="note.txt"\r\nContent-Disposition: attachment; filename="note.txt"\r\n\r\nAttachment body\r\n--fixture-boundary--\r\n`;
}

async function cleanup(client: Client, marker: string): Promise<void> {
  await client.query(
    "delete from webhook_deliveries where event_id in (select id from email_events where user_id like $1)",
    [`${marker}%`],
  );
  await client.query("delete from email_events where user_id like $1", [
    `${marker}%`,
  ]);
  await client.query("delete from forwarding_attempts where user_id like $1", [
    `${marker}%`,
  ]);
  await client.query("delete from forwarding_rules where user_id like $1", [
    `${marker}%`,
  ]);
  await client.query("delete from emails where user_id like $1", [
    `${marker}%`,
  ]);
  await client.query(
    "delete from inbound_provider_events where user_id like $1 or raw_metadata->>'test_run_id' = $2",
    [`${marker}%`, marker],
  );
  await client.query("delete from received_emails where user_id like $1", [
    `${marker}%`,
  ]);
  await client.query("delete from receiving_routes where user_id like $1", [
    `${marker}%`,
  ]);
  await client.query("delete from domains where user_id like $1", [
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

describeIfDb("inbound MIME ingestion with real Postgres", () => {
  const marker = `it-inbound-${randomUUID()}`;
  const tenantA = `${marker}-tenant-a`;
  const tenantB = `${marker}-tenant-b`;
  const domainA = `${marker}.a.example.test`;
  const domainB = `${marker}.b.example.test`;
  const client = new Client({ connectionString: databaseUrl });
  const receivedService = createReceivedEmailService();
  const forwardingService = createForwardingRuleService();

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
    const capabilities = JSON.stringify([{ name: "receiving", enabled: true }]);
    const domainAId = randomUUID();
    const domainBId = randomUUID();
    await client.query(
      "insert into domains (id, name, status, region, capabilities, user_id) values ($1, $2, 'verified', 'us-east-1', $3::jsonb, $4), ($5, $6, 'verified', 'us-east-1', $7::jsonb, $8)",
      [
        domainAId,
        domainA,
        capabilities,
        tenantA,
        domainBId,
        domainB,
        capabilities,
        tenantB,
      ],
    );
    await client.query(
      "insert into receiving_routes (user_id, domain_id, type, local_part, target_local_part) values ($1, $2, 'exact', 'support', 'support'), ($3, $4, 'exact', 'support', 'support')",
      [tenantA, domainAId, tenantB, domainBId],
    );
  });

  afterAll(async () => {
    await cleanup(client, marker);
    await client.end();
  });

  it("accepts an ingester provider notification, stores a tenant-scoped received email, and deduplicates retries", async () => {
    const eventId = `${marker}-evt-1`;
    const body = {
      provider: "fixture",
      event_id: eventId,
      message_id: `${marker}-msg-1`,
      recipients: [`support@${domainA}`],
      raw_mime: buildMime({
        from: "sender@example.test",
        to: `support@${domainA}`,
        subject: "Tenant A inbound",
        attachment: true,
      }),
      metadata: {
        test_run_id: marker,
        provider_request_id: "request-1",
        authorization: "Bearer should-not-persist",
      },
    };

    const response = await app.request("/events/inbound", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    expect(response.status).toBe(202);
    const json = (await response.json()) as {
      received_email_id: string;
      event_id: string;
    };
    expect(json.received_email_id).toMatch(/^[0-9a-f-]{36}$/);

    const tenantAList = await receivedService.listReceivedEmails({
      userId: tenantA,
    });
    expect(tenantAList.data.map((email) => email.id)).toContain(
      json.received_email_id,
    );
    const tenantBList = await receivedService.listReceivedEmails({
      userId: tenantB,
    });
    expect(tenantBList.data.map((email) => email.id)).not.toContain(
      json.received_email_id,
    );

    await expect(
      receivedService.getReceivedEmail(json.received_email_id, tenantB),
    ).rejects.toEqual(
      new ReceivedEmailServiceError(
        "received_email_not_found",
        "Received email not found",
      ),
    );

    const attachmentList = await receivedService.listAttachments(
      json.received_email_id,
      tenantA,
    );
    expect(attachmentList.data).toEqual([
      {
        id: expect.stringMatching(/^att_/),
        filename: "note.txt",
        content_type: "text/plain",
        size: 15,
      },
    ]);

    const eventRows = await client.query<{
      status: string;
      raw_metadata: { authorization?: string; test_run_id?: string };
      received_email_id: string | null;
    }>(
      "select status, raw_metadata, received_email_id from inbound_provider_events where provider = 'fixture' and provider_event_id = $1 order by created_at asc",
      [eventId],
    );
    expect(eventRows.rows[0]).toMatchObject({
      status: "processed",
      received_email_id: json.received_email_id,
    });
    expect(eventRows.rows[0]?.raw_metadata.authorization).toBe("[redacted]");
    expect(eventRows.rows[0]?.raw_metadata.test_run_id).toBe(marker);

    const durableEventRows = await client.query<{
      type: string;
      payload: { received_email_id?: string };
    }>(
      "select type, payload from email_events where id = $1 and user_id = $2",
      [json.event_id, tenantA],
    );
    expect(durableEventRows.rows[0]).toMatchObject({
      type: "received",
      payload: { received_email_id: json.received_email_id },
    });

    const duplicateResponse = await app.request("/events/inbound", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    expect(duplicateResponse.status).toBe(200);
    await expect(duplicateResponse.json()).resolves.toMatchObject({
      ok: false,
      status: "duplicate_provider_event",
    });

    const countRows = await client.query<{ count: string }>(
      "select count(*) from received_emails where user_id = $1 and subject = 'Tenant A inbound'",
      [tenantA],
    );
    expect(countRows.rows[0]?.count).toBe("1");
    const duplicateRows = await client.query<{ status: string }>(
      "select status from inbound_provider_events where provider_event_id = $1 order by created_at desc limit 1",
      [eventId],
    );
    expect(duplicateRows.rows[0]?.status).toBe("duplicate_provider_event");
  });

  it("rejects unsafe raw MIME URLs before fetching remote content", async () => {
    const service = createInboundEmailIngestionService();

    await expect(
      service.process({
        provider: "fixture",
        eventId: `${marker}-raw-url-ssrf`,
        recipients: [`support@${domainA}`],
        rawMimeUrl: "http://169.254.169.254/latest/meta-data",
        metadata: { test_run_id: marker },
      }),
    ).resolves.toMatchObject({
      status: "malformed_mime",
      reason: "Raw MIME URL is not allowed",
    });
  });

  it("creates a persisted forwarding attempt and outbound send row after inbound routing", async () => {
    const routeRows = await client.query<{ id: string }>(
      "select id from receiving_routes where user_id = $1 and local_part = 'support' limit 1",
      [tenantA],
    );
    const routeId = routeRows.rows[0]?.id;
    expect(routeId).toBeTruthy();

    const rule = await forwardingService.createRule({
      userId: tenantA,
      routeId: routeId ?? "",
      destinations: [`forward-${marker}@external.example.test`],
    });

    const eventId = `${marker}-forwarding`;
    const outcome = await createInboundEmailIngestionService().process({
      provider: "fixture",
      eventId,
      messageId: `${marker}-forwarding-msg`,
      recipients: [`support@${domainA}`],
      rawMime: buildMime({
        from: "sender@example.test",
        to: `support@${domainA}`,
        subject: "Forward me",
      }),
      metadata: { test_run_id: marker },
    });

    expect(outcome).toMatchObject({ status: "processed", user_id: tenantA });
    if (outcome.status !== "processed") {
      throw new Error("Expected processed inbound message");
    }

    const attempts = await forwardingService.listAttemptsForReceivedEmail(
      tenantA,
      outcome.received_email_id,
    );
    expect(attempts.data).toEqual([
      expect.objectContaining({
        rule_id: rule.id,
        received_email_id: outcome.received_email_id,
        status: "queued",
        reason: "queued",
        destinations: [`forward-${marker}@external.example.test`],
        forwarded_email_status: "queued",
      }),
    ]);

    const forwardedEmailId = attempts.data[0]?.forwarded_email_id;
    expect(forwardedEmailId).toMatch(/^[0-9a-f-]{36}$/);
    const emailRows = await client.query<{
      from: string;
      to: string[];
      subject: string;
      user_id: string;
      headers: Record<string, string>;
    }>(
      'select "from", "to", subject, user_id, headers from emails where id = $1',
      [forwardedEmailId],
    );
    expect(emailRows.rows[0]).toMatchObject({
      from: `support@${domainA}`,
      to: [`forward-${marker}@external.example.test`],
      subject: "Fwd: Forward me",
      user_id: tenantA,
      headers: expect.objectContaining({
        "X-OpenSend-Forwarded-Received-Email-ID": outcome.received_email_id,
        "X-OpenSend-Forwarding-Rule-ID": rule.id,
      }),
    });

    const receivedRows = await client.query<{ count: string }>(
      "select count(*) from received_emails where id = $1 and user_id = $2",
      [outcome.received_email_id, tenantA],
    );
    expect(receivedRows.rows[0]?.count).toBe("1");
  });

  it("threads matched replies, keeps unmatched replies visible, and blocks cross-tenant token attachment", async () => {
    const outboundEmailId = randomUUID();
    const contactId = randomUUID();
    const token = generateReplyToken({
      userId: tenantA,
      emailId: outboundEmailId,
      replyDomain: domainA,
    });
    const replyAddress = `reply+${token}@${domainA}`;
    await client.query(
      "insert into contacts (id, email, user_id) values ($1, $2, $3)",
      [contactId, "customer@example.test", tenantA],
    );
    await client.query(
      'insert into emails (id, "from", "to", subject, html, text, reply_to, headers, status, user_id, thread_id, reply_address, reply_token) values ($1, $2, $3::jsonb, $4, $5, $6, $7::jsonb, $8::jsonb, $9, $10, $11, $12, $13)',
      [
        outboundEmailId,
        `support@${domainA}`,
        JSON.stringify(["customer@example.test"]),
        "Original support email",
        "<p>Hello</p>",
        "Hello",
        JSON.stringify([replyAddress]),
        JSON.stringify({ "X-OpenSend-Reply-Token": token }),
        "sent",
        tenantA,
        outboundEmailId,
        replyAddress,
        token,
      ],
    );

    const matched = await createInboundEmailIngestionService().process({
      provider: "fixture",
      eventId: `${marker}-reply-matched`,
      recipients: [replyAddress],
      rawMime: [
        "From: Customer <customer@example.test>",
        `To: ${replyAddress}`,
        "Subject: Re: Original support email",
        `In-Reply-To: <${token}@${domainA}>`,
        "Content-Type: text/plain; charset=utf-8",
        "",
        "Thanks for the update",
      ].join("\r\n"),
      metadata: { test_run_id: marker },
    });
    expect(matched).toMatchObject({ status: "processed", user_id: tenantA });
    if (matched.status !== "processed") throw new Error("Expected match");

    const matchedRows = await client.query<{
      reply_match_status: string;
      reply_to_email_id: string | null;
      thread_id: string | null;
      contact_id: string | null;
    }>(
      "select reply_match_status, reply_to_email_id, thread_id, contact_id from received_emails where id = $1",
      [matched.received_email_id],
    );
    expect(matchedRows.rows[0]).toEqual({
      reply_match_status: "matched",
      reply_to_email_id: outboundEmailId,
      thread_id: outboundEmailId,
      contact_id: contactId,
    });
    const matchedDetail = await receivedService.getReceivedEmail(
      matched.received_email_id,
      tenantA,
    );
    expect(matchedDetail.thread.messages.map((message) => message.id)).toEqual([
      outboundEmailId,
      matched.received_email_id,
    ]);

    const unmatched = await createInboundEmailIngestionService().process({
      provider: "fixture",
      eventId: `${marker}-reply-unmatched`,
      recipients: [`support@${domainA}`],
      rawMime: buildMime({
        from: "unknown@example.test",
        to: `support@${domainA}`,
        subject: "Unmatched support reply",
      }),
      metadata: { test_run_id: marker },
    });
    expect(unmatched).toMatchObject({ status: "processed", user_id: tenantA });
    if (unmatched.status !== "processed") throw new Error("Expected process");
    const unmatchedDetail = await receivedService.getReceivedEmail(
      unmatched.received_email_id,
      tenantA,
    );
    expect(unmatchedDetail.reply_match_status).toBe("unmatched");
    expect(unmatchedDetail.reply_to_email_id).toBeNull();

    const invalidToken = `${token.slice(0, -1)}${token.endsWith("0") ? "1" : "0"}`;
    const invalidReplyAddress = `reply+${invalidToken}@${domainA}`;
    const invalidReply = await createInboundEmailIngestionService().process({
      provider: "fixture",
      eventId: `${marker}-reply-invalid-token`,
      recipients: [invalidReplyAddress],
      rawMime: [
        "From: Customer <customer@example.test>",
        `To: ${invalidReplyAddress}`,
        "Subject: Re: Stale token",
        "Content-Type: text/plain; charset=utf-8",
        "",
        "This should remain auditable but unmatched",
      ].join("\r\n"),
      metadata: { test_run_id: marker },
    });
    expect(invalidReply).toMatchObject({
      status: "processed",
      user_id: tenantA,
    });
    if (invalidReply.status !== "processed") {
      throw new Error("Expected invalid reply token to remain visible");
    }
    const invalidRows = await client.query<{
      reply_match_status: string;
      reply_to_email_id: string | null;
      thread_id: string | null;
    }>(
      "select reply_match_status, reply_to_email_id, thread_id from received_emails where id = $1",
      [invalidReply.received_email_id],
    );
    expect(invalidRows.rows[0]).toEqual({
      reply_match_status: "unmatched",
      reply_to_email_id: null,
      thread_id: null,
    });

    const crossTenant = await createInboundEmailIngestionService().process({
      provider: "fixture",
      eventId: `${marker}-reply-cross-tenant`,
      recipients: [`support@${domainB}`],
      rawMime: [
        "From: Customer <customer@example.test>",
        `To: support@${domainB}`,
        "Subject: Re: Cross tenant attempt",
        `X-OpenSend-Reply-Token: ${token}`,
        "Content-Type: text/plain; charset=utf-8",
        "",
        "This must not attach to tenant A",
      ].join("\r\n"),
      metadata: { test_run_id: marker },
    });
    expect(crossTenant).toMatchObject({
      status: "processed",
      user_id: tenantB,
    });
    if (crossTenant.status !== "processed") {
      throw new Error("Expected cross-tenant message to remain visible");
    }
    const crossRows = await client.query<{
      user_id: string;
      reply_match_status: string;
      reply_to_email_id: string | null;
      thread_id: string | null;
    }>(
      "select user_id, reply_match_status, reply_to_email_id, thread_id from received_emails where id = $1",
      [crossTenant.received_email_id],
    );
    expect(crossRows.rows[0]).toEqual({
      user_id: tenantB,
      reply_match_status: "unmatched",
      reply_to_email_id: null,
      thread_id: null,
    });
  });

  it("records terminal malformed, missing-domain, oversized, and storage-failure states", async () => {
    const malformed = await app.request("/events/inbound", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        provider: "fixture",
        event_id: `${marker}-malformed`,
        raw_mime: "not a header\n\nbody",
        metadata: { test_run_id: marker },
      }),
    });
    expect(malformed.status).toBe(200);
    await expect(malformed.json()).resolves.toMatchObject({
      status: "malformed_mime",
    });

    const unrouteable = await app.request("/events/inbound", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        provider: "fixture",
        event_id: `${marker}-missing-domain`,
        raw_mime: buildMime({
          from: "sender@example.test",
          to: "nobody@missing.example.test",
          subject: "No route",
        }),
        metadata: { test_run_id: marker },
      }),
    });
    expect(unrouteable.status).toBe(200);
    await expect(unrouteable.json()).resolves.toMatchObject({
      status: "missing_domain",
    });

    const failingService = createInboundEmailIngestionService({
      maxBytes: 8,
      uploadFile: async () => {
        throw new Error("local storage unavailable");
      },
    });

    await expect(
      failingService.process({
        provider: "fixture",
        eventId: `${marker}-oversized`,
        rawMime: buildMime({
          from: "sender@example.test",
          to: `support@${domainA}`,
          subject: "Too large",
        }),
        metadata: { test_run_id: marker },
      }),
    ).resolves.toMatchObject({ status: "oversized_message" });

    const storageService = createInboundEmailIngestionService({
      uploadFile: async () => {
        throw new Error("local storage unavailable");
      },
    });
    await expect(
      storageService.process({
        provider: "fixture",
        eventId: `${marker}-storage-failure`,
        rawMime: buildMime({
          from: "sender@example.test",
          to: `support@${domainA}`,
          subject: "Storage fails",
          attachment: true,
        }),
        metadata: { test_run_id: marker },
      }),
    ).resolves.toMatchObject({ status: "storage_failure" });

    const statuses = await client.query<{ status: string }>(
      "select status from inbound_provider_events where raw_metadata->>'test_run_id' = $1",
      [marker],
    );
    expect(statuses.rows.map((row) => row.status)).toEqual(
      expect.arrayContaining([
        "malformed_mime",
        "missing_domain",
        "oversized_message",
        "storage_failure",
      ]),
    );
  });
});
