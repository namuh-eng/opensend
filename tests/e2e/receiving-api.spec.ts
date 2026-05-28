import { randomUUID } from "node:crypto";
import { generateReplyToken } from "@opensend/core";
import app from "../../packages/ingester/src/index";
import {
  cleanupE2ERun,
  createE2ETenant,
  expect,
  getE2EBaseUrl,
  test,
} from "./fixtures/auth";

function buildInboundMime(input: {
  from: string;
  to: string;
  subject: string;
}): string {
  return `From: ${input.from}\r\nTo: ${input.to}\r\nSubject: ${input.subject}\r\nContent-Type: multipart/mixed; boundary="e2e-boundary"\r\n\r\n--e2e-boundary\r\nContent-Type: text/plain; charset=utf-8\r\n\r\nHello from ingester\r\n--e2e-boundary\r\nContent-Type: text/plain; name="e2e-note.txt"\r\nContent-Disposition: attachment; filename="e2e-note.txt"\r\n\r\nAttachment body\r\n--e2e-boundary--\r\n`;
}

test("received email APIs are tenant-scoped across list, detail, and attachments", async ({
  e2eDb,
  e2eRunId,
  playwright,
}) => {
  await cleanupE2ERun(e2eDb, e2eRunId);

  const tenantA = await createE2ETenant(e2eDb, e2eRunId, "receiving-a");
  const tenantB = await createE2ETenant(e2eDb, e2eRunId, "receiving-b");
  const tenantAEmailId = randomUUID();
  const tenantBEmailId = randomUUID();

  await e2eDb.query(
    `insert into received_emails (id, "from", "to", subject, html, text, attachments, user_id)
     values
       ($1, $2, $3::jsonb, $4, $5, $6, $7::jsonb, $8),
       ($9, $10, $11::jsonb, $12, $13, $14, $15::jsonb, $16)`,
    [
      tenantAEmailId,
      `sender-a@${e2eRunId}.e2e.opensend.test`,
      JSON.stringify([`agent-a@${e2eRunId}.e2e.opensend.test`]),
      "Tenant A inbound",
      "<p>A</p>",
      "A",
      JSON.stringify([
        {
          id: "att-a-1",
          filename: "tenant-a.txt",
          contentType: "text/plain",
          size: 12,
          s3Key: `received/${tenantAEmailId}/tenant-a.txt`,
        },
      ]),
      tenantA.user.id,
      tenantBEmailId,
      `sender-b@${e2eRunId}.e2e.opensend.test`,
      JSON.stringify([`agent-b@${e2eRunId}.e2e.opensend.test`]),
      "Tenant B inbound",
      "<p>B</p>",
      "B",
      JSON.stringify([]),
      tenantB.user.id,
    ],
  );

  const tenantARequest = await playwright.request.newContext({
    baseURL: getE2EBaseUrl(),
    extraHTTPHeaders: { Authorization: tenantA.apiKey.authorization },
  });
  const tenantBRequest = await playwright.request.newContext({
    baseURL: getE2EBaseUrl(),
    extraHTTPHeaders: { Authorization: tenantB.apiKey.authorization },
  });

  try {
    const tenantBList = await tenantBRequest.get("/emails/receiving", {
      params: { limit: "20" },
    });
    expect(tenantBList.status()).toBe(200);
    const tenantBListJson = (await tenantBList.json()) as {
      data: Array<{ id: string; subject: string }>;
    };
    expect(tenantBListJson.data.map((email) => email.id)).toContain(
      tenantBEmailId,
    );
    expect(tenantBListJson.data.map((email) => email.id)).not.toContain(
      tenantAEmailId,
    );

    const crossTenantDetail = await tenantBRequest.get(
      `/emails/receiving/${tenantAEmailId}`,
    );
    expect(crossTenantDetail.status()).toBe(404);

    const crossTenantAttachments = await tenantBRequest.get(
      `/emails/receiving/${tenantAEmailId}/attachments`,
    );
    expect(crossTenantAttachments.status()).toBe(404);

    const tenantADetail = await tenantARequest.get(
      `/emails/receiving/${tenantAEmailId}`,
    );
    expect(tenantADetail.status()).toBe(200);
    await expect(tenantADetail.json()).resolves.toMatchObject({
      object: "received_email",
      id: tenantAEmailId,
      subject: "Tenant A inbound",
      text: "A",
    });

    const tenantAAttachment = await tenantARequest.get(
      `/emails/receiving/${tenantAEmailId}/attachments/att-a-1`,
    );
    expect(tenantAAttachment.status()).toBe(200);
    await expect(tenantAAttachment.json()).resolves.toMatchObject({
      object: "received_email_attachment",
      id: "att-a-1",
      filename: "tenant-a.txt",
      download_url: `https://localhost/dev/received/${tenantAEmailId}/tenant-a.txt`,
    });
  } finally {
    await tenantARequest.dispose();
    await tenantBRequest.dispose();
    await cleanupE2ERun(e2eDb, e2eRunId);
  }
});

test("receiving route CRUD is tenant-scoped for overlapping local parts", async ({
  e2eDb,
  e2eRunId,
  playwright,
}) => {
  await cleanupE2ERun(e2eDb, e2eRunId);

  const tenantA = await createE2ETenant(e2eDb, e2eRunId, "routes-a");
  const tenantB = await createE2ETenant(e2eDb, e2eRunId, "routes-b");
  const tenantADomainId = randomUUID();
  const tenantBDomainId = randomUUID();
  const tenantADomain = `inbound-a.${e2eRunId}.e2e.opensend.test`;
  const tenantBDomain = `inbound-b.${e2eRunId}.e2e.opensend.test`;
  const capabilities = JSON.stringify([
    { name: "sending", enabled: true },
    { name: "receiving", enabled: true },
  ]);

  await e2eDb.query(
    `insert into domains (id, name, status, region, capabilities, user_id)
     values
       ($1, $2, 'verified', 'us-east-1', $3::jsonb, $4),
       ($5, $6, 'verified', 'us-east-1', $7::jsonb, $8)`,
    [
      tenantADomainId,
      tenantADomain,
      capabilities,
      tenantA.user.id,
      tenantBDomainId,
      tenantBDomain,
      capabilities,
      tenantB.user.id,
    ],
  );

  const tenantARequest = await playwright.request.newContext({
    baseURL: getE2EBaseUrl(),
    extraHTTPHeaders: { Authorization: tenantA.apiKey.authorization },
  });
  const tenantBRequest = await playwright.request.newContext({
    baseURL: getE2EBaseUrl(),
    extraHTTPHeaders: { Authorization: tenantB.apiKey.authorization },
  });

  try {
    const createA = await tenantARequest.post("/api/receiving/routes", {
      data: {
        domain_id: tenantADomainId,
        type: "exact",
        local_part: "support",
      },
    });
    expect(createA.status()).toBe(201);
    const routeA = (await createA.json()) as {
      id: string;
      target_address: string;
    };
    expect(routeA.target_address).toBe(`support@${tenantADomain}`);

    const createB = await tenantBRequest.post("/api/receiving/routes", {
      data: {
        domain_id: tenantBDomainId,
        type: "exact",
        local_part: "support",
        target_local_part: "inbox",
      },
    });
    expect(createB.status()).toBe(201);
    const routeB = (await createB.json()) as {
      id: string;
      target_address: string;
    };
    expect(routeB.target_address).toBe(`inbox@${tenantBDomain}`);

    const crossTenantCreate = await tenantBRequest.post(
      "/api/receiving/routes",
      {
        data: {
          domain_id: tenantADomainId,
          type: "alias",
          local_part: "help",
          target_local_part: "support",
        },
      },
    );
    expect(crossTenantCreate.status()).toBe(404);

    const tenantBList = await tenantBRequest.get("/api/receiving/routes", {
      params: { domain_id: tenantBDomainId },
    });
    expect(tenantBList.status()).toBe(200);
    const tenantBListJson = (await tenantBList.json()) as {
      data: Array<{ id: string; local_part: string; target_address: string }>;
    };
    expect(tenantBListJson.data.map((route) => route.id)).toContain(routeB.id);
    expect(tenantBListJson.data.map((route) => route.id)).not.toContain(
      routeA.id,
    );

    const crossTenantRead = await tenantBRequest.get(
      `/api/receiving/routes/${routeA.id}`,
    );
    expect(crossTenantRead.status()).toBe(404);
  } finally {
    await tenantARequest.dispose();
    await tenantBRequest.dispose();
    await cleanupE2ERun(e2eDb, e2eRunId);
  }
});

test("inbound ingester notifications become tenant-scoped received email API rows", async ({
  e2eDb,
  e2eRunId,
  playwright,
}) => {
  await cleanupE2ERun(e2eDb, e2eRunId);

  const tenantA = await createE2ETenant(e2eDb, e2eRunId, "ingest-a");
  const tenantB = await createE2ETenant(e2eDb, e2eRunId, "ingest-b");
  const tenantADomainId = randomUUID();
  const tenantBDomainId = randomUUID();
  const tenantADomain = `ingest-a.${e2eRunId}.e2e.opensend.test`;
  const tenantBDomain = `ingest-b.${e2eRunId}.e2e.opensend.test`;
  const capabilities = JSON.stringify([{ name: "receiving", enabled: true }]);

  await e2eDb.query(
    `insert into domains (id, name, status, region, capabilities, user_id)
     values
       ($1, $2, 'verified', 'us-east-1', $3::jsonb, $4),
       ($5, $6, 'verified', 'us-east-1', $7::jsonb, $8)`,
    [
      tenantADomainId,
      tenantADomain,
      capabilities,
      tenantA.user.id,
      tenantBDomainId,
      tenantBDomain,
      capabilities,
      tenantB.user.id,
    ],
  );
  await e2eDb.query(
    `insert into receiving_routes (user_id, domain_id, type, local_part, target_local_part)
     values ($1, $2, 'exact', 'support', 'support'), ($3, $4, 'exact', 'support', 'support')`,
    [tenantA.user.id, tenantADomainId, tenantB.user.id, tenantBDomainId],
  );

  const providerEventId = `${e2eRunId}-provider-event`;
  const inboundResponse = await app.request("/events/inbound", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      provider: "playwright-fixture",
      event_id: providerEventId,
      message_id: `${e2eRunId}-message`,
      recipients: [`support@${tenantADomain}`],
      raw_mime: buildInboundMime({
        from: "sender@example.test",
        to: `support@${tenantADomain}`,
        subject: "Playwright inbound",
      }),
      metadata: { test_run_id: e2eRunId },
    }),
  });
  expect(inboundResponse.status).toBe(202);
  const inboundJson = (await inboundResponse.json()) as {
    received_email_id: string;
  };

  const tenantARequest = await playwright.request.newContext({
    baseURL: getE2EBaseUrl(),
    extraHTTPHeaders: { Authorization: tenantA.apiKey.authorization },
  });
  const tenantBRequest = await playwright.request.newContext({
    baseURL: getE2EBaseUrl(),
    extraHTTPHeaders: { Authorization: tenantB.apiKey.authorization },
  });

  try {
    const tenantADetail = await tenantARequest.get(
      `/emails/receiving/${inboundJson.received_email_id}`,
    );
    expect(tenantADetail.status()).toBe(200);
    await expect(tenantADetail.json()).resolves.toMatchObject({
      object: "received_email",
      id: inboundJson.received_email_id,
      subject: "Playwright inbound",
      text: "Hello from ingester",
    });

    const tenantBAttempt = await tenantBRequest.get(
      `/emails/receiving/${inboundJson.received_email_id}`,
    );
    expect(tenantBAttempt.status()).toBe(404);

    const attachments = await tenantARequest.get(
      `/emails/receiving/${inboundJson.received_email_id}/attachments`,
    );
    expect(attachments.status()).toBe(200);
    const attachmentsJson = (await attachments.json()) as {
      data: Array<{ id: string; filename: string }>;
    };
    expect(attachmentsJson.data).toEqual([
      {
        id: expect.stringMatching(/^att_/),
        filename: "e2e-note.txt",
        content_type: "text/plain",
        size: 15,
      },
    ]);

    const attachmentDetail = await tenantARequest.get(
      `/emails/receiving/${inboundJson.received_email_id}/attachments/${attachmentsJson.data[0]?.id}`,
    );
    expect(attachmentDetail.status()).toBe(200);
    await expect(attachmentDetail.json()).resolves.toMatchObject({
      filename: "e2e-note.txt",
      download_url: expect.stringContaining(
        `received/${inboundJson.received_email_id}/`,
      ),
    });
  } finally {
    await tenantARequest.dispose();
    await tenantBRequest.dispose();
    await cleanupE2ERun(e2eDb, e2eRunId);
  }
});

test("dashboard creates an inbound forwarding rule and shows a forwarding result", async ({
  authenticatedPage,
  e2eDb,
  e2eRunId,
  e2eTenant,
}) => {
  const domainId = randomUUID();
  const domain = `forwarding.${e2eRunId}.e2e.opensend.test`;
  const capabilities = JSON.stringify([
    { name: "sending", enabled: true },
    { name: "receiving", enabled: true },
  ]);

  await e2eDb.query(
    `insert into domains (id, name, status, region, capabilities, user_id)
     values ($1, $2, 'verified', 'us-east-1', $3::jsonb, $4)`,
    [domainId, domain, capabilities, e2eTenant.user.id],
  );
  const routeRows = await e2eDb.query<{ id: string }>(
    `insert into receiving_routes (user_id, domain_id, type, local_part, target_local_part)
     values ($1, $2, 'exact', 'support', 'support')
     returning id`,
    [e2eTenant.user.id, domainId],
  );
  const routeId = routeRows.rows[0]?.id;
  expect(routeId).toBeTruthy();

  await authenticatedPage.goto("/emails/receiving");
  await expect(
    authenticatedPage.getByText(domain, { exact: true }),
  ).toBeVisible();
  await authenticatedPage
    .getByLabel(`Forwarding destinations for support@${domain}`)
    .fill(`ops-${e2eRunId}@external.example.test`);
  await authenticatedPage
    .getByRole("button", { name: "Add forwarding" })
    .click();
  await expect(authenticatedPage.getByText("Forwarding active")).toBeVisible();
  await expect(
    authenticatedPage.getByText(`ops-${e2eRunId}@external.example.test`),
  ).toBeVisible();

  const inboundResponse = await app.request("/events/inbound", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      provider: "playwright-fixture",
      event_id: `${e2eRunId}-forwarding-dashboard`,
      message_id: `${e2eRunId}-forwarding-message`,
      recipients: [`support@${domain}`],
      raw_mime: buildInboundMime({
        from: "sender@example.test",
        to: `support@${domain}`,
        subject: "Dashboard forwarding",
      }),
      metadata: { test_run_id: e2eRunId },
    }),
  });
  expect(inboundResponse.status).toBe(202);

  await authenticatedPage.reload();
  await expect(authenticatedPage.getByText("Last forward:")).toBeVisible();
  await expect(authenticatedPage.getByText("queued")).toBeVisible();
  await expect(authenticatedPage.getByText("outbound queued")).toBeVisible();

  const attemptRows = await e2eDb.query<{ count: string }>(
    `select count(*) from forwarding_attempts
     where user_id = $1 and status = 'queued' and forwarded_email_id is not null`,
    [e2eTenant.user.id],
  );
  expect(attemptRows.rows[0]?.count).toBe("1");
});

test("outbound email detail shows matched inbound reply thread context", async ({
  authenticatedPage,
  e2eDb,
  e2eRunId,
  e2eTenant,
}) => {
  const domainId = randomUUID();
  const outboundEmailId = randomUUID();
  const contactId = randomUUID();
  const domain = `replies.${e2eRunId}.e2e.opensend.test`;
  const capabilities = JSON.stringify([
    { name: "sending", enabled: true },
    { name: "receiving", enabled: true },
  ]);
  const token = generateReplyToken({
    userId: e2eTenant.user.id,
    emailId: outboundEmailId,
    replyDomain: domain,
  });
  const replyAddress = `reply+${token}@${domain}`;

  await e2eDb.query(
    `insert into domains (id, name, status, region, capabilities, user_id)
     values ($1, $2, 'verified', 'us-east-1', $3::jsonb, $4)`,
    [domainId, domain, capabilities, e2eTenant.user.id],
  );
  await e2eDb.query(
    `insert into contacts (id, email, user_id, document)
     values ($1, $2, $3, $4::jsonb)`,
    [
      contactId,
      `customer@${e2eRunId}.e2e.opensend.test`,
      e2eTenant.user.id,
      JSON.stringify({ test_run_id: e2eRunId }),
    ],
  );
  await e2eDb.query(
    `insert into emails
       (id, "from", "to", subject, html, text, reply_to, headers, status, user_id, thread_id, reply_address, reply_token, sent_at)
     values
       ($1, $2, $3::jsonb, $4, $5, $6, $7::jsonb, $8::jsonb, 'sent', $9, $10, $11, $12, now())`,
    [
      outboundEmailId,
      `support@${domain}`,
      JSON.stringify([`customer@${e2eRunId}.e2e.opensend.test`]),
      "Threaded support question",
      "<p>Can we help?</p>",
      "Can we help?",
      JSON.stringify([replyAddress]),
      JSON.stringify({ "X-OpenSend-Reply-Token": token }),
      e2eTenant.user.id,
      outboundEmailId,
      replyAddress,
      token,
    ],
  );

  const inboundResponse = await app.request("/events/inbound", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      provider: "playwright-fixture",
      event_id: `${e2eRunId}-reply-thread`,
      message_id: `${e2eRunId}-reply-thread-message`,
      recipients: [replyAddress],
      raw_mime: [
        `From: Customer <customer@${e2eRunId}.e2e.opensend.test>`,
        `To: ${replyAddress}`,
        "Subject: Re: Threaded support question",
        `References: <${token}@${domain}>`,
        "Content-Type: text/plain; charset=utf-8",
        "",
        "Thanks, this answers my question.",
      ].join("\r\n"),
      metadata: { test_run_id: e2eRunId },
    }),
  });
  expect(inboundResponse.status).toBe(202);

  await authenticatedPage.goto(`/emails/${outboundEmailId}`);
  await expect(
    authenticatedPage.getByTestId("reply-tracking-card"),
  ).toContainText(replyAddress);
  await expect(
    authenticatedPage.getByTestId("conversation-thread"),
  ).toContainText("Reply matched");
  await expect(authenticatedPage.getByTestId("thread-message")).toHaveCount(2);
  await expect(
    authenticatedPage.getByText("Thanks, this answers my question."),
  ).toBeVisible();

  const rows = await e2eDb.query<{ reply_match_status: string }>(
    "select reply_match_status from received_emails where user_id = $1 and reply_to_email_id = $2",
    [e2eTenant.user.id, outboundEmailId],
  );
  expect(rows.rows[0]?.reply_match_status).toBe("matched");
});
