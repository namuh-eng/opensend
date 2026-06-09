import { randomUUID } from "node:crypto";
import { createE2ETenant, expect, getE2EBaseUrl, test } from "./fixtures/auth";

async function createDedicatedIpPlan(
  e2eDb: { query: (sql: string, values?: unknown[]) => Promise<unknown> },
  runId: string,
  userId: string,
): Promise<string> {
  const planId = randomUUID();
  const planResult = (await e2eDb.query(
    `insert into plans (id, slug, name, monthly_price_cents, dedicated_ips_enabled, max_dedicated_ips)
     values ($1, $2, 'E2E Dedicated IP', 0, true, 3)
     on conflict (slug) do update
       set dedicated_ips_enabled = true,
           max_dedicated_ips = 3
     returning id`,
    [planId, `e2e-dedicated-${runId}`.slice(0, 64)],
  )) as { rows: Array<{ id: string }> };
  const effectivePlanId = planResult.rows[0]?.id ?? planId;
  await e2eDb.query(
    `insert into subscriptions (user_id, plan_id, status)
     values ($1, $2, 'active')
     on conflict (user_id) do update set plan_id = excluded.plan_id`,
    [userId, effectivePlanId],
  );
  return effectivePlanId;
}

test("domain deliverability readiness is tenant-scoped and visible on dashboard", async ({
  authenticatedPage,
  e2eApiRequest,
  e2eDb,
  e2eRunId,
  e2eTenant,
  playwright,
}) => {
  const domainId = randomUUID();
  const domainName = `bimi-${e2eRunId}.example.test`;
  const records = [
    {
      type: "TXT",
      name: `_dmarc.${domainName}`,
      value: "v=DMARC1; p=reject; adkim=s",
      status: "verified",
      ttl: "Auto",
    },
    {
      type: "TXT",
      name: `default._bimi.${domainName}`,
      value:
        "v=BIMI1; l=https://assets.example.test/logo.svg; a=https://assets.example.test/vmc.pem",
      status: "verified",
      ttl: "Auto",
    },
  ];

  await e2eDb.query(
    `insert into domains (id, name, status, region, records, capabilities, user_id)
     values ($1, $2, 'verified', 'us-east-1', $3::jsonb, $4::jsonb, $5)`,
    [
      domainId,
      domainName,
      JSON.stringify(records),
      JSON.stringify([{ name: "sending", enabled: true }]),
      e2eTenant.user.id,
    ],
  );

  const tenantB = await createE2ETenant(e2eDb, e2eRunId, "deliverability-b");
  const tenantBRequest = await playwright.request.newContext({
    baseURL: getE2EBaseUrl(),
    extraHTTPHeaders: { Authorization: tenantB.apiKey.authorization },
  });

  try {
    const res = await e2eApiRequest.get(
      `/api/domains/${domainId}/deliverability`,
    );
    expect(res.status()).toBe(200);
    const body = (await res.json()) as {
      bimi: { status: string; record_name: string };
      apple_branded_mail: { mode: string };
    };
    expect(body.bimi.status).toBe("ready");
    expect(body.bimi.record_name).toBe(`default._bimi.${domainName}`);
    expect(body.apple_branded_mail.mode).toBe("operator_notes_only");

    const patchRes = await e2eApiRequest.patch(
      `/api/domains/${domainId}/deliverability`,
      {
        data: {
          apple_branded_mail_status: "manual_review",
          apple_branded_mail_notes: "Submitted outside OpenSend by operator.",
        },
      },
    );
    expect(patchRes.status()).toBe(200);

    const tenantBRes = await tenantBRequest.get(
      `/api/domains/${domainId}/deliverability`,
    );
    expect(tenantBRes.status()).toBe(404);

    await authenticatedPage.goto(`/domains/${domainId}`);
    await expect(authenticatedPage.getByText("BIMI READINESS")).toBeVisible();
    await expect(
      authenticatedPage.getByText("Automated DNS/status check only."),
    ).toBeVisible();
    await expect(
      authenticatedPage.getByText("BRANDED MAIL & DEDICATED IP"),
    ).toBeVisible();
  } finally {
    await tenantBRequest.dispose();
  }
});

test("dedicated IP lifecycle API records manual status without provider provisioning", async ({
  e2eApiRequest,
  e2eDb,
  e2eRunId,
  e2eTenant,
}) => {
  await createDedicatedIpPlan(e2eDb, e2eRunId, e2eTenant.user.id);

  const createRes = await e2eApiRequest.post("/api/dedicated-ips", {
    data: {
      name: "Enterprise request",
      operator_notes: "Customer asked support for a dedicated IP.",
    },
  });
  expect(createRes.status()).toBe(201);
  const created = (await createRes.json()) as {
    id: string;
    status: string;
    provider: string;
    provider_pool_name: string | null;
  };
  expect(created.status).toBe("requested");
  expect(created.provider).toBe("manual");
  expect(created.provider_pool_name).toBeNull();

  const patchRes = await e2eApiRequest.patch(
    `/api/dedicated-ips/${created.id}`,
    {
      data: {
        status: "warming",
        provider_pool_name: "operator-pool-1",
        operator_notes: "Provider pool exists; warmup runbook is manual.",
      },
    },
  );
  expect(patchRes.status()).toBe(200);
  const patched = (await patchRes.json()) as {
    status: string;
    provider_pool_name: string | null;
    warming_started_at: string | null;
  };
  expect(patched.status).toBe("warming");
  expect(patched.provider_pool_name).toBe("operator-pool-1");
  expect(patched.warming_started_at).toBeTruthy();
});
