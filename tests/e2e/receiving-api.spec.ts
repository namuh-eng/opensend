import { randomUUID } from "node:crypto";
import {
  cleanupE2ERun,
  createE2ETenant,
  expect,
  getE2EBaseUrl,
  test,
} from "./fixtures/auth";

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
