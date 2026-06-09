import { expect, test } from "./fixtures/auth";

test("today dashboard does not treat a config-set name alone as wired feedback", async ({
  authenticatedPage: page,
  e2eDb,
  e2eRunId,
  e2eTenant,
}) => {
  const unwiredDomain = `unwired-${e2eRunId}.e2e.opensend.test`;
  const wiredDomain = `wired-${e2eRunId}.e2e.opensend.test`;

  await e2eDb.query(
    `insert into domains (
       name, status, region, user_id, track_opens, ses_configuration_set_name
     )
     values
       ($1, 'verified', 'us-east-1', $3, false, null),
       ($2, 'verified', 'us-east-1', $3, true, $4)`,
    [
      unwiredDomain,
      wiredDomain,
      e2eTenant.user.id,
      `opensend-domain-wired-${e2eRunId}`,
    ],
  );

  const sentOnly = await e2eDb.query<{ id: string }>(
    `insert into emails ("from", "to", subject, status, user_id, created_at)
     values ($1, $2::jsonb, 'Unwired sent only', 'sent', $3, now())
     returning id`,
    [
      `hi@${unwiredDomain}`,
      JSON.stringify([`recipient@${e2eRunId}.e2e.opensend.test`]),
      e2eTenant.user.id,
    ],
  );
  const delivered = await e2eDb.query<{ id: string }>(
    `insert into emails ("from", "to", subject, status, user_id, created_at)
     values ($1, $2::jsonb, 'Wired delivered', 'sent', $3, now())
     returning id`,
    [
      `hi@${wiredDomain}`,
      JSON.stringify([`delivered@${e2eRunId}.e2e.opensend.test`]),
      e2eTenant.user.id,
    ],
  );

  await e2eDb.query(
    `insert into email_events (email_id, source_id, type, payload, user_id, received_at)
     values ($1, $2, 'delivered', '{}'::jsonb, $3, now())`,
    [
      delivered.rows[0]?.id,
      `e2e-today-delivered-${e2eRunId}`,
      e2eTenant.user.id,
    ],
  );

  await page.goto("/today");

  const reputationCard = page
    .getByText("Reputation by domain")
    .locator("xpath=ancestor::div[contains(@class, 'rounded-card')][1]");
  const unwiredRow = reputationCard
    .getByText(unwiredDomain, { exact: true })
    .locator("xpath=ancestor::div[contains(@class, 'grid')][1]");
  const wiredRow = reputationCard
    .getByText(wiredDomain, { exact: true })
    .locator("xpath=ancestor::div[contains(@class, 'grid')][1]");

  await expect(page.getByText("Sent · 24h").locator("..")).toContainText("2");
  const deliveredCard = page
    .getByText("Delivered", { exact: true })
    .locator("xpath=ancestor::div[contains(@class, 'rounded-card')][1]");
  await expect(deliveredCard).toContainText("Not wired");
  await expect(unwiredRow).toContainText("Not wired");
  await expect(unwiredRow).toContainText("Off");
  await expect(wiredRow).toContainText("Not wired");
  await expect(page.getByText(sentOnly.rows[0]?.id ?? "")).toHaveCount(0);
});

test("today dashboard marks provider feedback unknown when recent sender domains exceed the live SES read cap", async ({
  authenticatedPage: page,
  e2eDb,
  e2eRunId,
  e2eTenant,
}) => {
  const domainSuffix = `${e2eRunId}.cap.e2e.opensend.test`;
  const senderCount = 51;

  await e2eDb.query(
    `insert into domains (
       name, status, region, user_id, track_opens, ses_configuration_set_name
     )
     select
       'cap-' || g::text || '-' || $1,
       'verified',
       'us-east-1',
       $2,
       false,
       null
     from generate_series(1, $3) g`,
    [domainSuffix, e2eTenant.user.id, senderCount],
  );

  await e2eDb.query(
    `insert into emails ("from", "to", subject, status, user_id, created_at)
     select
       'hi@cap-' || g::text || '-' || $1,
       $2::jsonb,
       'Capped sender domain',
       'sent',
       $3,
       now() - (g::text || ' seconds')::interval
     from generate_series(1, $4) g`,
    [
      domainSuffix,
      JSON.stringify([`recipient@${e2eRunId}.e2e.opensend.test`]),
      e2eTenant.user.id,
      senderCount,
    ],
  );

  await page.goto("/today");

  const deliveredCard = page
    .getByText("Delivered", { exact: true })
    .locator("xpath=ancestor::div[contains(@class, 'rounded-card')][1]");
  await expect(deliveredCard).toContainText("Unknown");
});
