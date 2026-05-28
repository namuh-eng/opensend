import { createE2ETenant, expect, test } from "./fixtures/auth";

test("dashboard email detail trace shows sanitized event details and linked logs for one tenant", async ({
  authenticatedPage: page,
  e2eDb,
  e2eRunId,
  e2eTenant,
}) => {
  const otherTenant = await createE2ETenant(e2eDb, e2eRunId, "other");
  const recipient = `trace@${e2eRunId}.e2e.opensend.test`;
  const otherRecipient = `other-trace@${e2eRunId}.e2e.opensend.test`;
  const rawSecret = `Bearer e2e-secret-${e2eRunId}`;
  const rawBody = `raw-html-secret-${e2eRunId}`;
  const tagValue = `trace-${e2eRunId}`;
  const otherTenantMarker = `other-tenant-marker-${e2eRunId}`;

  const insertedEmail = await e2eDb.query<{ id: string }>(
    `insert into emails ("from", "to", subject, html, text, status, tags, user_id, created_at)
     values ($1, $2::jsonb, $3, $4, $5, 'bounced', $6::jsonb, $7, $8)
     returning id`,
    [
      "sender@example.com",
      JSON.stringify([recipient]),
      "Trace detail e2e",
      "<p>Hello trace</p>",
      "Hello trace",
      JSON.stringify([{ name: "campaign", value: tagValue }]),
      e2eTenant.user.id,
      "2026-05-28T00:00:00.000Z",
    ],
  );
  const emailId = insertedEmail.rows[0]?.id ?? "";
  expect(emailId).toBeTruthy();

  const insertedOtherEmail = await e2eDb.query<{ id: string }>(
    `insert into emails ("from", "to", subject, status, user_id, created_at)
     values ($1, $2::jsonb, $3, 'bounced', $4, $5)
     returning id`,
    [
      "sender@example.com",
      JSON.stringify([otherRecipient]),
      otherTenantMarker,
      otherTenant.user.id,
      "2026-05-28T00:00:00.000Z",
    ],
  );
  const otherEmailId = insertedOtherEmail.rows[0]?.id ?? "";
  expect(otherEmailId).toBeTruthy();

  const sentEvent = await e2eDb.query<{ id: string }>(
    `insert into email_events (email_id, source_id, type, payload, user_id, received_at)
     values ($1, $2, 'sent', $3::jsonb, $4, $5)
     returning id`,
    [
      emailId,
      `e2e-trace-sent-${e2eRunId}`,
      JSON.stringify({ messageId: `ses-message-${e2eRunId}` }),
      e2eTenant.user.id,
      "2026-05-28T00:01:00.000Z",
    ],
  );
  const sentEventId = sentEvent.rows[0]?.id ?? "";

  const bounceEvent = await e2eDb.query<{ id: string }>(
    `insert into email_events (email_id, source_id, type, payload, user_id, received_at)
     values ($1, $2, 'bounced', $3::jsonb, $4, $5)
     returning id`,
    [
      emailId,
      `e2e-trace-bounced-${e2eRunId}`,
      JSON.stringify({
        bounceType: "Permanent",
        bounceSubType: "General",
        bouncedRecipients: [
          {
            emailAddress: recipient,
            action: "failed",
            status: "5.1.1",
            diagnosticCode: "smtp; 550 5.1.1 user unknown",
          },
        ],
        authorization: rawSecret,
        html: rawBody,
      }),
      e2eTenant.user.id,
      "2026-05-28T00:02:00.000Z",
    ],
  );
  const bounceEventId = bounceEvent.rows[0]?.id ?? "";
  expect(sentEventId).toBeTruthy();
  expect(bounceEventId).toBeTruthy();

  await e2eDb.query(
    `insert into email_events (email_id, source_id, type, payload, user_id, received_at)
     values ($1, $2, 'bounced', $3::jsonb, $4, $5)`,
    [
      otherEmailId,
      `e2e-trace-other-${e2eRunId}`,
      JSON.stringify({ bounceType: "Transient", reason: otherTenantMarker }),
      otherTenant.user.id,
      "2026-05-28T00:02:00.000Z",
    ],
  );

  const logResult = await e2eDb.query<{ id: string }>(
    `insert into logs (
       endpoint, status, method, user_agent, request_body, response_body,
       document, user_id, api_key_id, created_at
     )
     values ($1, 202, 'POST', $2, $3::jsonb, $4::jsonb, $5::jsonb, $6, $7, $8)
     returning id`,
    [
      "/api/emails",
      "opensend-e2e",
      JSON.stringify({ to: [recipient], subject: "Trace detail e2e" }),
      JSON.stringify({ id: emailId }),
      JSON.stringify({ emailId, test_run_id: e2eRunId }),
      e2eTenant.user.id,
      e2eTenant.apiKey.id,
      "2026-05-27T23:59:59.000Z",
    ],
  );
  const logId = logResult.rows[0]?.id ?? "";
  expect(logId).toBeTruthy();

  await e2eDb.query(
    `insert into logs (endpoint, status, method, document, user_id, api_key_id, created_at)
     values ($1, 202, 'POST', $2::jsonb, $3, $4, $5)`,
    [
      `/api/${otherTenantMarker}`,
      JSON.stringify({ emailId: otherEmailId, test_run_id: e2eRunId }),
      otherTenant.user.id,
      otherTenant.apiKey.id,
      "2026-05-28T00:03:00.000Z",
    ],
  );

  await page.goto(`/emails/${emailId}`);

  await expect(page.getByText("MESSAGE TRACE")).toBeVisible();
  const eventRows = page.getByTestId("event-trace-row");
  await expect(eventRows).toHaveCount(4);
  await expect(eventRows.nth(0).getByTestId("event-badge")).toHaveText(
    "Api Request",
  );
  await expect(eventRows.nth(1).getByTestId("event-badge")).toHaveText(
    "Created",
  );
  await expect(eventRows.nth(2).getByTestId("event-badge")).toHaveText("Sent");
  await expect(eventRows.nth(3).getByTestId("event-badge")).toHaveText(
    "Bounced",
  );
  await expect(
    page.getByText(`trace_id: event:${bounceEventId}`),
  ).toBeVisible();
  await expect(page.getByText(`campaign=${tagValue}`)).toBeVisible();
  await expect(
    page.getByText("Permanent bounce", { exact: false }),
  ).toBeVisible();
  await expect(page.getByText("Diagnostic Code:")).toBeVisible();
  await expect(
    page.locator("dd").filter({ hasText: "smtp; 550 5.1.1 user unknown" }),
  ).toBeVisible();
  await expect(page.getByText(rawSecret)).toHaveCount(0);
  await expect(page.getByText(rawBody)).toHaveCount(0);
  await expect(page.getByText(otherTenantMarker)).toHaveCount(0);

  await expect(page.getByText("ASSOCIATED LOGS")).toBeVisible();
  await expect(
    page.locator("span").filter({ hasText: "same email_id" }),
  ).toBeVisible();
  await expect(page.getByText(`log_id: ${logId}`)).toBeVisible();
  await expect(
    page.getByRole("link", { name: /View all logs/i }),
  ).toHaveAttribute("href", `/logs?q=${encodeURIComponent(emailId)}`);
  await expect(page.locator(`a[href="/logs/${logId}"]`)).toBeVisible();

  const metricsResponse = await page.request.get(
    `/api/metrics?range=last_30_days&tag_name=campaign&tag_value=${encodeURIComponent(tagValue)}`,
  );
  expect(metricsResponse.ok()).toBeTruthy();
  const metricsJson = (await metricsResponse.json()) as {
    totalEmails: number;
    tagBreakdown: Array<{ name: string; value: string; count: number }>;
  };
  expect(metricsJson.totalEmails).toBeGreaterThanOrEqual(1);
  expect(metricsJson.tagBreakdown).toContainEqual(
    expect.objectContaining({ name: "campaign", value: tagValue, count: 1 }),
  );

  await page.goto("/metrics");
  await expect(
    page.getByTestId("tag-breakdown-row").filter({ hasText: tagValue }),
  ).toBeVisible();

  await page.goto(`/emails/${emailId}`);
  await expect(page.locator(`a[href="/logs/${logId}"]`)).toBeVisible();
  await page.locator(`a[href="/logs/${logId}"]`).click();
  await expect(
    page.getByRole("heading", { name: "POST /api/emails" }),
  ).toBeVisible();

  const notFoundResponse = await page.goto(`/emails/${otherEmailId}`);
  expect(notFoundResponse?.status()).toBe(404);
});
