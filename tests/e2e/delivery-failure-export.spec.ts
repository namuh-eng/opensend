import { readFile } from "node:fs/promises";
import { createE2ETenant, expect, test } from "./fixtures/auth";

test("dashboard delivery failure export uses session auth and tenant scope", async ({
  authenticatedPage: page,
  e2eDb,
  e2eRunId,
  e2eTenant,
}) => {
  const otherTenant = await createE2ETenant(e2eDb, e2eRunId, "other");
  const recipientA = `bounce@${e2eRunId}.e2e.opensend.test`;
  const suppressedA = `suppressed@${e2eRunId}.e2e.opensend.test`;
  const recipientB = `other@${e2eRunId}.e2e.opensend.test`;

  const insertedA = await e2eDb.query<{ id: string }>(
    `insert into emails ("from", "to", subject, status, user_id, created_at)
     values ($1, $2::jsonb, $3, 'bounced', $4, now())
     returning id`,
    [
      "sender@example.com",
      JSON.stringify([recipientA]),
      "Tenant A bounced",
      e2eTenant.user.id,
    ],
  );
  const emailAId = insertedA.rows[0]?.id ?? "";

  const insertedB = await e2eDb.query<{ id: string }>(
    `insert into emails ("from", "to", subject, status, user_id, created_at)
     values ($1, $2::jsonb, $3, 'bounced', $4, now())
     returning id`,
    [
      "sender@example.com",
      JSON.stringify([recipientB]),
      "Tenant B bounced",
      otherTenant.user.id,
    ],
  );

  await e2eDb.query(
    `insert into email_events (email_id, source_id, type, payload, user_id, received_at)
     values ($1, $2, 'bounced', $3::jsonb, $4, now())`,
    [
      emailAId,
      `e2e-source-${e2eRunId}-a`,
      JSON.stringify({ bounceType: "Permanent" }),
      e2eTenant.user.id,
    ],
  );
  await e2eDb.query(
    `insert into email_suppressions (
       user_id, email, reason, source_email_id, source_message_id,
       suppressed_at, updated_at
     )
     values ($1, $2, 'bounced', $3, $4, now(), now())
     on conflict (user_id, email) do update set updated_at = excluded.updated_at`,
    [e2eTenant.user.id, suppressedA, emailAId, `ses-${e2eRunId}-a`],
  );
  await e2eDb.query(
    `insert into email_suppressions (
       user_id, email, reason, source_email_id, source_message_id,
       suppressed_at, updated_at
     )
     values ($1, $2, 'bounced', $3, $4, now(), now())
     on conflict (user_id, email) do update set updated_at = excluded.updated_at`,
    [
      otherTenant.user.id,
      recipientB,
      insertedB.rows[0]?.id ?? null,
      `ses-${e2eRunId}-b`,
    ],
  );

  await page.goto("/emails");
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByLabel("Export").click(),
  ]);
  const path = await download.path();
  expect(path).toBeTruthy();

  const csv = await readFile(path ?? "", "utf8");
  expect(csv).toContain("id,recipient,status,reason,source_email_id");
  expect(csv).toContain(recipientA);
  expect(csv).toContain(suppressedA);
  expect(csv).not.toContain(recipientB);
});

test("empty dashboard delivery failure export shows a visible empty state", async ({
  authenticatedPage: page,
}) => {
  await page.goto("/emails");
  await page.getByLabel("Export").click();

  await expect(
    page.getByRole("status").filter({
      hasText:
        "No bounced, complained, or suppressed failures match these filters.",
    }),
  ).toBeVisible();
});
