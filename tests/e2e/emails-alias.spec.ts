import { createE2ETenant, expect, getE2EBaseUrl, test } from "./fixtures/auth";

test.describe("Resend-compatible /emails alias", () => {
  test("POST /emails reaches the JSON send API instead of dashboard routing", async ({
    request,
  }) => {
    const response = await request.post("/emails", {
      headers: {
        Authorization: "Basic invalid_key",
        "Content-Type": "application/json",
        "Idempotency-Key": "alias-e2e-invalid-key",
      },
      data: {
        from: "sender@example.com",
        to: "recipient@example.com",
        subject: "Alias",
        html: "<p>Hello</p>",
      },
    });

    expect(response.status()).toBe(401);
    expect(response.headers()["content-type"]).toContain("application/json");
    expect(response.headers().location).toBeUndefined();
    const json = await response.json();
    expect(json).toMatchObject({
      name: "malformed_api_key",
      code: "malformed_api_key",
      statusCode: 401,
    });
  });

  test("POST /emails/batch reaches the JSON batch API instead of dashboard routing", async ({
    request,
  }) => {
    const response = await request.post("/emails/batch", {
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": "batch-alias-e2e-missing-key",
      },
      data: [
        {
          from: "sender@example.com",
          to: "recipient@example.com",
          subject: "Batch alias",
          html: "<p>Hello</p>",
        },
      ],
    });

    expect(response.status()).toBe(401);
    expect(response.headers()["content-type"]).toContain("application/json");
    expect(response.headers().location).toBeUndefined();
    const json = await response.json();
    expect(json).toMatchObject({
      name: "missing_api_key",
      code: "missing_api_key",
      statusCode: 401,
    });
  });

  test("POST /emails accepts a normal JSON send and returns exactly the id envelope", async ({
    e2eApiRequest,
    e2eDb,
    e2eTenant,
  }) => {
    const response = await e2eApiRequest.post("/emails", {
      data: {
        from: "sender@example.com",
        to: "recipient@example.com",
        subject: "Alias happy path",
        html: "<p>Hello from alias</p>",
      },
    });

    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("application/json");
    const body = (await response.json()) as { id: string };

    expect(Object.keys(body)).toEqual(["id"]);
    const { rows } = await e2eDb.query<{
      user_id: string;
      status: string;
      to: string[];
    }>('select user_id, status, "to" from emails where id = $1', [body.id]);

    expect(rows).toEqual([
      {
        user_id: e2eTenant.user.id,
        status: "queued",
        to: ["recipient@example.com"],
      },
    ]);
  });

  test("POST /emails/batch replays duplicate Idempotency-Key responses without duplicate rows and stays tenant-scoped", async ({
    e2eApiRequest,
    e2eDb,
    e2eRunId,
    e2eTenant,
    playwright,
  }) => {
    const idempotencyKey = `batch-replay-${e2eRunId}`;
    const payload = [
      {
        from: "sender@example.com",
        to: `batch-a@${e2eRunId}.e2e.opensend.test`,
        subject: "Batch replay A",
        html: "<p>A</p>",
      },
      {
        from: "sender@example.com",
        to: `batch-b@${e2eRunId}.e2e.opensend.test`,
        subject: "Batch replay B",
        html: "<p>B</p>",
      },
    ];

    const first = await e2eApiRequest.post("/emails/batch", {
      headers: { "Idempotency-Key": idempotencyKey },
      data: payload,
    });
    expect(first.status()).toBe(200);
    const firstBody = (await first.json()) as { data: Array<{ id: string }> };
    expect(firstBody.data).toHaveLength(2);

    const retry = await e2eApiRequest.post("/emails/batch", {
      headers: { "Idempotency-Key": idempotencyKey },
      data: payload,
    });
    expect(retry.status()).toBe(200);
    await expect(retry.json()).resolves.toEqual(firstBody);

    const primaryRows = await e2eDb.query<{
      total: string;
      keyed: string;
      replay_document: unknown;
    }>(
      `select count(*)::text as total,
              count(*) filter (where idempotency_key = $2)::text as keyed,
              (
                select document->'idempotency'->'response'
                  from emails
                 where user_id = $1 and idempotency_key = $2
                 limit 1
              ) as replay_document
         from emails
        where user_id = $1
          and subject in ('Batch replay A', 'Batch replay B')`,
      [e2eTenant.user.id, idempotencyKey],
    );
    expect(primaryRows.rows[0]).toMatchObject({ total: "2", keyed: "1" });
    expect(primaryRows.rows[0]?.replay_document).toEqual(firstBody);

    const otherTenant = await createE2ETenant(e2eDb, e2eRunId, "batch-other");
    const otherRequest = await playwright.request.newContext({
      baseURL: getE2EBaseUrl(),
      extraHTTPHeaders: { Authorization: otherTenant.apiKey.authorization },
    });
    try {
      const other = await otherRequest.post("/emails/batch", {
        headers: { "Idempotency-Key": idempotencyKey },
        data: payload.map((item) => ({
          ...item,
          subject: `${item.subject} other`,
        })),
      });
      expect(other.status()).toBe(200);
      const otherBody = (await other.json()) as { data: Array<{ id: string }> };
      expect(otherBody.data).toHaveLength(2);
      expect(otherBody).not.toEqual(firstBody);
    } finally {
      await otherRequest.dispose();
    }

    const otherRows = await e2eDb.query<{ total: string; keyed: string }>(
      `select count(*)::text as total,
              count(*) filter (where idempotency_key = $2)::text as keyed
         from emails
        where user_id = $1
          and subject in ('Batch replay A other', 'Batch replay B other')`,
      [otherTenant.user.id, idempotencyKey],
    );
    expect(otherRows.rows[0]).toEqual({ total: "2", keyed: "1" });
  });

  test("POST /emails and /emails/batch accept reused Idempotency-Key values after 24 hours", async ({
    e2eApiRequest,
    e2eDb,
    e2eRunId,
    e2eTenant,
  }) => {
    const singleKey = `single-expired-${e2eRunId}`;
    const firstSingle = await e2eApiRequest.post("/emails", {
      headers: { "Idempotency-Key": singleKey },
      data: {
        from: "sender@example.com",
        to: `single-expired-a@${e2eRunId}.e2e.opensend.test`,
        subject: "Single expired original",
        html: "<p>Original</p>",
      },
    });
    expect(firstSingle.status()).toBe(200);
    const firstSingleBody = (await firstSingle.json()) as { id: string };

    await e2eDb.query(
      `update emails
          set created_at = now() - interval '25 hours'
        where id = $1 and user_id = $2`,
      [firstSingleBody.id, e2eTenant.user.id],
    );

    const secondSingle = await e2eApiRequest.post("/emails", {
      headers: { "Idempotency-Key": singleKey },
      data: {
        from: "sender@example.com",
        to: `single-expired-b@${e2eRunId}.e2e.opensend.test`,
        subject: "Single expired fresh",
        html: "<p>Fresh</p>",
      },
    });
    expect(secondSingle.status()).toBe(200);
    const secondSingleBody = (await secondSingle.json()) as { id: string };
    expect(secondSingleBody.id).not.toBe(firstSingleBody.id);

    const singleRows = await e2eDb.query<{ total: string; keyed: string }>(
      `select count(*)::text as total,
              count(*) filter (where idempotency_key = $2)::text as keyed
         from emails
        where user_id = $1
          and subject in ('Single expired original', 'Single expired fresh')`,
      [e2eTenant.user.id, singleKey],
    );
    expect(singleRows.rows[0]).toEqual({ total: "2", keyed: "1" });

    const batchKey = `batch-expired-${e2eRunId}`;
    const firstBatch = await e2eApiRequest.post("/emails/batch", {
      headers: { "Idempotency-Key": batchKey },
      data: [
        {
          from: "sender@example.com",
          to: `batch-expired-a@${e2eRunId}.e2e.opensend.test`,
          subject: "Batch expired original A",
          html: "<p>A</p>",
        },
        {
          from: "sender@example.com",
          to: `batch-expired-b@${e2eRunId}.e2e.opensend.test`,
          subject: "Batch expired original B",
          html: "<p>B</p>",
        },
      ],
    });
    expect(firstBatch.status()).toBe(200);
    const firstBatchBody = (await firstBatch.json()) as {
      data: Array<{ id: string }>;
    };

    await e2eDb.query(
      `update emails
          set created_at = now() - interval '25 hours'
        where id = $1 and user_id = $2`,
      [firstBatchBody.data[0]?.id, e2eTenant.user.id],
    );

    const secondBatch = await e2eApiRequest.post("/emails/batch", {
      headers: { "Idempotency-Key": batchKey },
      data: [
        {
          from: "sender@example.com",
          to: `batch-expired-c@${e2eRunId}.e2e.opensend.test`,
          subject: "Batch expired fresh A",
          html: "<p>C</p>",
        },
        {
          from: "sender@example.com",
          to: `batch-expired-d@${e2eRunId}.e2e.opensend.test`,
          subject: "Batch expired fresh B",
          html: "<p>D</p>",
        },
      ],
    });
    expect(secondBatch.status()).toBe(200);
    const secondBatchBody = (await secondBatch.json()) as {
      data: Array<{ id: string }>;
    };
    expect(secondBatchBody).not.toEqual(firstBatchBody);

    const batchRows = await e2eDb.query<{ total: string; keyed: string }>(
      `select count(*)::text as total,
              count(*) filter (where idempotency_key = $2)::text as keyed
         from emails
        where user_id = $1
          and subject in (
            'Batch expired original A',
            'Batch expired original B',
            'Batch expired fresh A',
            'Batch expired fresh B'
          )`,
      [e2eTenant.user.id, batchKey],
    );
    expect(batchRows.rows[0]).toEqual({ total: "4", keyed: "1" });
  });

  test("GET /emails keeps the dashboard sign-in flow", async ({ page }) => {
    await page.goto("/emails");

    await expect(page).toHaveURL(/\/auth/);
  });
});
