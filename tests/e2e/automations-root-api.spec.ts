import { createE2ETenant, expect, getE2EBaseUrl, test } from "./fixtures/auth";

test.describe("Resend-compatible /automations root API", () => {
  test("uses API-key auth, preserves dashboard navigation, isolates tenants, and stops deterministically", async ({
    authenticatedPage: page,
    e2eApiRequest,
    e2eDb,
    e2eRunId,
    e2eTenant,
    playwright,
  }) => {
    await page.goto("/automations");
    await expect(
      page.getByRole("heading", { name: "Automations", exact: true }),
    ).toBeVisible();

    const cookieOnlyRequest = await playwright.request.newContext({
      baseURL: getE2EBaseUrl(),
      extraHTTPHeaders: {
        Accept: "application/json",
        Cookie: `better-auth.session_token=${e2eTenant.user.signedSessionToken}`,
      },
    });
    try {
      const cookieOnlyApiResponse = await cookieOnlyRequest.get("/automations");
      expect(cookieOnlyApiResponse.status()).toBe(401);
    } finally {
      await cookieOnlyRequest.dispose();
    }

    const name = `root-automation-${e2eRunId.slice(0, 24)}`;
    const triggerEventName = `root.automation.${e2eRunId}`;
    const createResponse = await e2eApiRequest.post("/automations", {
      data: {
        name,
        status: "enabled",
        trigger_event_name: triggerEventName,
        steps: [
          {
            key: "trigger",
            type: "trigger",
            config: { event_name: triggerEventName },
            position: 0,
          },
          { key: "end", type: "end", config: {}, position: 1 },
        ],
        connections: [{ from: "trigger", to: "end" }],
      },
    });
    expect(createResponse.status()).toBe(201);
    const created = (await createResponse.json()) as {
      id: string;
      status: string;
      trigger_event_name: string;
    };
    expect(created).toMatchObject({
      id: expect.any(String),
      status: "enabled",
      trigger_event_name: triggerEventName,
    });

    const runRows = await e2eDb.query<{ id: string }>(
      `insert into automation_runs (
         automation_id, status, current_step_key, step_states,
         user_id, started_at, next_step_at
       )
       values (
         $1, 'waiting', 'trigger', $2::jsonb,
         $3, now(), now() + interval '1 hour'
       )
       returning id`,
      [
        created.id,
        JSON.stringify({ trigger: { status: "waiting" } }),
        e2eTenant.user.id,
      ],
    );
    const runId = runRows.rows[0]?.id;
    expect(runId).toEqual(expect.any(String));

    const listResponse = await e2eApiRequest.get("/automations?limit=100");
    expect(listResponse.status()).toBe(200);
    const listed = (await listResponse.json()) as {
      object: string;
      data: Array<{ id: string; name: string; status: string }>;
      has_more: boolean;
    };
    expect(listed.object).toBe("list");
    expect(listed.data).toContainEqual(
      expect.objectContaining({ id: created.id, name, status: "enabled" }),
    );

    const detailResponse = await e2eApiRequest.get(
      `/automations/${created.id}`,
    );
    expect(detailResponse.status()).toBe(200);
    await expect(detailResponse.json()).resolves.toMatchObject({
      id: created.id,
      steps: [
        expect.objectContaining({ key: "trigger" }),
        expect.objectContaining({ key: "end" }),
      ],
    });

    const runsResponse = await e2eApiRequest.get(
      `/automations/${created.id}/runs?limit=10`,
    );
    expect(runsResponse.status()).toBe(200);
    await expect(runsResponse.json()).resolves.toMatchObject({
      object: "list",
      data: [expect.objectContaining({ id: runId, status: "waiting" })],
    });

    const runDetailResponse = await e2eApiRequest.get(
      `/automations/${created.id}/runs/${runId}`,
    );
    expect(runDetailResponse.status()).toBe(200);
    await expect(runDetailResponse.json()).resolves.toMatchObject({
      id: runId,
      automation_id: created.id,
      status: "waiting",
    });

    const stopResponse = await e2eApiRequest.post(
      `/automations/${created.id}/stop`,
    );
    expect(stopResponse.status()).toBe(200);
    await expect(stopResponse.json()).resolves.toMatchObject({
      id: created.id,
      status: "disabled",
    });

    const stoppedRows = await e2eDb.query<{
      automation_status: string;
      run_status: string;
    }>(
      `select a.status as automation_status, r.status as run_status
       from automations a
       join automation_runs r on r.automation_id = a.id
       where a.id = $1 and r.id = $2`,
      [created.id, runId],
    );
    expect(stoppedRows.rows).toEqual([
      { automation_status: "disabled", run_status: "waiting" },
    ]);

    const stopAgainResponse = await e2eApiRequest.post(
      `/automations/${created.id}/stop`,
    );
    expect(stopAgainResponse.status()).toBe(200);
    await expect(stopAgainResponse.json()).resolves.toMatchObject({
      id: created.id,
      status: "disabled",
    });

    const otherTenant = await createE2ETenant(e2eDb, e2eRunId, "secondary");
    const otherRequest = await playwright.request.newContext({
      baseURL: getE2EBaseUrl(),
      extraHTTPHeaders: {
        Authorization: otherTenant.apiKey.authorization,
      },
    });

    try {
      const crossTenantDetail = await otherRequest.get(
        `/automations/${created.id}`,
      );
      expect(crossTenantDetail.status()).toBe(404);

      const crossTenantStop = await otherRequest.post(
        `/automations/${created.id}/stop`,
      );
      expect(crossTenantStop.status()).toBe(404);
    } finally {
      await otherRequest.dispose();
    }

    const deleteResponse = await e2eApiRequest.delete(
      `/automations/${created.id}`,
    );
    expect(deleteResponse.status()).toBe(200);
    await expect(deleteResponse.json()).resolves.toEqual({
      object: "automation",
      id: created.id,
      deleted: true,
    });
  });
});
