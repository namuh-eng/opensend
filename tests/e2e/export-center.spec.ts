import { expect, test } from "./fixtures/auth";

async function seedEmail(input: {
  client: import("pg").Client;
  userId: string;
  to: string;
  subject: string;
}) {
  const { rows } = await input.client.query<{ id: string }>(
    `insert into emails ("from", "to", subject, status, user_id, created_at)
     values ($1, $2::jsonb, $3, 'sent', $4, now())
     returning id`,
    [
      "sender@example.com",
      JSON.stringify([input.to]),
      input.subject,
      input.userId,
    ],
  );
  return rows[0]?.id ?? "";
}

test("dashboard export center creates and downloads a tenant-scoped email CSV", async ({
  authenticatedPage,
  e2eDb,
  e2eTenant,
}) => {
  const recipient = `export-center-${Date.now()}@example.com`;
  const emailId = await seedEmail({
    client: e2eDb,
    userId: e2eTenant.user.id,
    to: recipient,
    subject: "Export center proof",
  });

  await authenticatedPage.goto("/exports");
  await expect(
    authenticatedPage.getByRole("heading", { name: "Export Center" }),
  ).toBeVisible();
  await authenticatedPage.getByLabel("Export resource").selectOption("emails");
  await authenticatedPage
    .getByPlaceholder("Optional search text")
    .fill(recipient);
  await authenticatedPage
    .getByRole("button", { name: "Create export" })
    .click();

  await expect(
    authenticatedPage.getByText("Export ready with 1 emails row."),
  ).toBeVisible();
  await expect(authenticatedPage.getByText("completed").first()).toBeVisible();

  const downloadPromise = authenticatedPage.waitForEvent("download");
  await authenticatedPage
    .getByRole("link", { name: "Download" })
    .first()
    .click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  if (!stream) throw new Error("Expected export download stream");

  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const csv = Buffer.concat(chunks).toString("utf8");

  expect(download.suggestedFilename()).toMatch(
    /^emails-\d{4}-\d{2}-\d{2}\.csv$/,
  );
  expect(csv).toContain(
    "id,to,from,subject,status,created_at,sent_at,scheduled_at",
  );
  expect(csv).toContain(emailId);
  expect(csv).toContain(recipient);
  expect(csv).toContain("Export center proof");

  const { rows } = await e2eDb.query<{ download_count: number }>(
    "select download_count from dashboard_export_jobs where user_id = $1 order by created_at desc limit 1",
    [e2eTenant.user.id],
  );
  expect(rows[0]?.download_count).toBe(1);
});
