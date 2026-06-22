import type { Client } from "pg";
import { type E2ETenant, createE2ETenant, expect, test } from "./fixtures/auth";

type SeededAudience = {
  contactEmail: string;
  contactId: string;
  deletedContactEmail: string;
  segmentId: string;
  segmentName: string;
  propertyKey: string;
  propertyName: string;
  topicName: string;
  otherTenantContactEmail: string;
};

async function insertSegments(
  client: Client,
  runId: string,
  userId: string,
): Promise<Array<{ id: string; name: string }>> {
  const rows: Array<{ id: string; name: string }> = [];

  for (let index = 0; index < 8; index += 1) {
    const { rows: inserted } = await client.query<{ id: string; name: string }>(
      `insert into segments (name, contacts_count, unsubscribed_count, user_id, document)
       values ($1, $2, $3, $4, $5::jsonb)
       returning id, name`,
      [
        `PR660 Segment ${index} ${runId}`,
        index === 0 ? 23 : index + 1,
        index === 0 ? 5 : 0,
        userId,
        JSON.stringify({ test_run_id: runId }),
      ],
    );
    const segment = inserted[0];
    if (segment) rows.push(segment);
  }

  return rows;
}

async function insertTopics(
  client: Client,
  runId: string,
  userId: string,
): Promise<Array<{ id: string; name: string }>> {
  const rows: Array<{ id: string; name: string }> = [];

  for (let index = 0; index < 6; index += 1) {
    const { rows: inserted } = await client.query<{ id: string; name: string }>(
      `insert into topics (
         name,
         description,
         default_subscription,
         visibility,
         user_id,
         document
       )
       values ($1, $2, $3, $4, $5, $6::jsonb)
       returning id, name`,
      [
        `PR660 Topic ${index} ${runId}`,
        `Sanitized topic ${index}`,
        index % 2 === 0 ? "opt_out" : "opt_in",
        index % 3 === 0 ? "private" : "public",
        userId,
        JSON.stringify({ test_run_id: runId }),
      ],
    );
    const topic = inserted[0];
    if (topic) rows.push(topic);
  }

  return rows;
}

async function insertProperties(
  client: Client,
  runId: string,
  userId: string,
): Promise<Array<{ key: string; name: string }>> {
  const rows: Array<{ key: string; name: string }> = [];

  for (let index = 0; index < 6; index += 1) {
    const key = `pr660_${runId}_${index}`.replace(/-/g, "_");
    const { rows: inserted } = await client.query<{
      key: string;
      name: string;
    }>(
      `insert into contact_properties (
         key,
         name,
         type,
         fallback_value,
         user_id,
         document
       )
       values ($1, $2, $3, $4, $5, $6::jsonb)
       returning key, name`,
      [
        key,
        `PR660 Property ${index}`,
        index % 2 === 0 ? "string" : "number",
        index % 2 === 0 ? "unknown" : "0",
        userId,
        JSON.stringify({ test_run_id: runId }),
      ],
    );
    const property = inserted[0];
    if (property) rows.push(property);
  }

  return rows;
}

async function insertContacts(
  client: Client,
  runId: string,
  userId: string,
  segmentName: string,
  topicId: string,
  count: number,
): Promise<Array<{ id: string; email: string }>> {
  const rows: Array<{ id: string; email: string }> = [];

  for (let index = 0; index < count; index += 1) {
    const email = `pr660-contact-${index}@${runId}.e2e.opensend.test`;
    const { rows: inserted } = await client.query<{
      id: string;
      email: string;
    }>(
      `insert into contacts (
         email,
         first_name,
         last_name,
         unsubscribed,
         custom_properties,
         segments,
         topic_subscriptions,
         user_id,
         document
       )
       values ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8, $9::jsonb)
       returning id, email`,
      [
        email,
        `First ${index}`,
        `Last ${index}`,
        index < 9,
        JSON.stringify({ plan: index % 2 === 0 ? "pro" : "free" }),
        JSON.stringify(index % 2 === 0 ? [segmentName] : []),
        JSON.stringify([{ topicId, subscribed: index % 2 === 0 }]),
        userId,
        JSON.stringify({ test_run_id: runId }),
      ],
    );
    const contact = inserted[0];
    if (contact) rows.push(contact);
  }

  return rows;
}

async function seedAudienceInventory(
  client: Client,
  runId: string,
  tenant: E2ETenant,
): Promise<SeededAudience> {
  const segments = await insertSegments(client, runId, tenant.user.id);
  const topics = await insertTopics(client, runId, tenant.user.id);
  const properties = await insertProperties(client, runId, tenant.user.id);
  const primarySegment = segments[0];
  const primaryTopic = topics[0];
  const primaryProperty = properties[0];

  if (!primarySegment || !primaryTopic || !primaryProperty) {
    throw new Error("Failed to seed PR 660 audience metadata");
  }

  const contacts = await insertContacts(
    client,
    runId,
    tenant.user.id,
    primarySegment.name,
    primaryTopic.id,
    45,
  );
  const primaryContact = contacts[10];
  const deletedContact = contacts[12];
  if (!primaryContact || !deletedContact) {
    throw new Error("Failed to seed PR 660 contacts");
  }

  return {
    contactEmail: primaryContact.email,
    contactId: primaryContact.id,
    deletedContactEmail: deletedContact.email,
    segmentId: primarySegment.id,
    segmentName: primarySegment.name,
    propertyKey: primaryProperty.key,
    propertyName: primaryProperty.name,
    topicName: primaryTopic.name,
    otherTenantContactEmail: `pr660-other@${runId}.e2e.opensend.test`,
  };
}

async function seedOtherTenantContact(
  client: Client,
  runId: string,
  userId: string,
  email: string,
): Promise<void> {
  await client.query(
    `insert into contacts (email, first_name, last_name, user_id, document)
     values ($1, 'Other', 'Tenant', $2, $3::jsonb)`,
    [email, userId, JSON.stringify({ test_run_id: runId })],
  );
}

test("PR 660 audience inventory works for dashboard users at local production scale", async ({
  authenticatedPage: page,
  e2eDb,
  e2eRunId,
  e2eTenant,
}) => {
  const seeded = await seedAudienceInventory(e2eDb, e2eRunId, e2eTenant);
  const otherTenant = await createE2ETenant(e2eDb, e2eRunId, "other");
  await seedOtherTenantContact(
    e2eDb,
    e2eRunId,
    otherTenant.user.id,
    seeded.otherTenantContactEmail,
  );

  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await test.step("contacts inventory: tenant stats, filters, cursor pagination, row menu, and detail edit/delete", async () => {
    await page.goto("/audience");
    await expect(page.getByRole("heading", { name: "Audience" })).toBeVisible();
    await expect(
      page
        .getByText("ALL CONTACTS", { exact: true })
        .locator("..")
        .getByText("45", {
          exact: true,
        }),
    ).toBeVisible();
    await expect(
      page
        .getByText("SUBSCRIBERS", { exact: true })
        .locator("..")
        .getByText("36", {
          exact: true,
        }),
    ).toBeVisible();
    await expect(
      page
        .getByText("UNSUBSCRIBERS", { exact: true })
        .locator("..")
        .getByText("9", {
          exact: true,
        }),
    ).toBeVisible();

    await expect(page.getByPlaceholder(/search by name, email/i)).toBeVisible();
    await expect(page.locator("select").first()).toContainText(
      seeded.segmentName,
    );
    await expect(page.getByRole("button", { name: "Export" })).toBeVisible();
    await expect(page.getByText("Page 1 – showing 40 contacts")).toBeVisible();

    await page.getByRole("button", { name: "→" }).click();
    await expect(page.getByText("Page 2 – showing 5 contacts")).toBeVisible();
    await page.getByRole("button", { name: "←" }).click();
    await expect(page.getByText("Page 1 – showing 40 contacts")).toBeVisible();

    await page.locator("select").first().selectOption(seeded.segmentId);
    await expect(
      page.locator("tr", { hasText: seeded.segmentName }).first(),
    ).toBeVisible();

    const searchInput = page.getByPlaceholder(/search by name, email/i);
    await searchInput.fill(seeded.contactEmail);
    await expect(
      page.getByRole("link", { name: seeded.contactEmail }),
    ).toBeVisible();
    await expect(
      page.getByText(seeded.otherTenantContactEmail),
    ).not.toBeVisible();

    const searchedRow = page.locator("tr", { hasText: seeded.contactEmail });
    await searchedRow.hover();
    await searchedRow.getByRole("button", { name: "More actions" }).click();
    await expect(
      page.getByRole("button", { name: "View / edit" }),
    ).toBeVisible();
    await page.keyboard.press("Escape");

    await page.getByRole("link", { name: seeded.contactEmail }).click();
    await expect(page).toHaveURL(
      new RegExp(`/audience/contacts/${seeded.contactId}`),
    );
    await expect(page.getByText("EMAIL ADDRESS")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Properties" }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Activity" })).toBeVisible();

    await page.getByRole("button", { name: "More actions" }).click();
    await page.getByRole("button", { name: "Edit contact" }).click();
    const editDialog = page.getByRole("dialog", { name: "Edit contact" });
    await expect(editDialog).toBeVisible();
    await editDialog.getByLabel("First name").fill("Edited");
    await editDialog.getByLabel("Last name").fill("Person");
    await editDialog.getByLabel("Unsubscribed from all mail").check();
    await editDialog.getByRole("button", { name: "Save" }).click();
    await expect(editDialog).not.toBeVisible();

    await expect
      .poll(async () => {
        const { rows } = await e2eDb.query<{
          first_name: string | null;
          last_name: string | null;
          unsubscribed: boolean;
        }>(
          "select first_name, last_name, unsubscribed from contacts where id = $1",
          [seeded.contactId],
        );
        return rows[0];
      })
      .toEqual({
        first_name: "Edited",
        last_name: "Person",
        unsubscribed: true,
      });

    await page.getByRole("button", { name: "More actions" }).click();
    await page.getByRole("button", { name: "Delete contact" }).click();
    const deleteDialog = page.getByRole("dialog", { name: "Delete contact" });
    await expect(deleteDialog).toBeVisible();
    await deleteDialog.getByRole("button", { name: "Cancel" }).click();
    await expect(deleteDialog).not.toBeVisible();

    await page.getByRole("button", { name: "More actions" }).click();
    await page.getByRole("button", { name: "Delete contact" }).click();
    await page
      .getByRole("dialog", { name: "Delete contact" })
      .getByRole("button", { name: "Delete" })
      .click();
    await expect(page).toHaveURL(/\/audience$/);
    await expect
      .poll(async () => {
        const { rows } = await e2eDb.query<{ id: string }>(
          "select id from contacts where id = $1",
          [seeded.contactId],
        );
        return rows.length;
      })
      .toBe(0);
  });

  await test.step("segments inventory: create modal, filtered contacts link, and destructive row action", async () => {
    await page.goto("/audience/segments");
    await expect(
      page.getByRole("button", { name: "Create segment" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Export" })).toBeVisible();
    await expect(
      page.getByRole("link", { name: seeded.segmentName }),
    ).toBeVisible();

    await page.getByRole("link", { name: seeded.segmentName }).click();
    await expect(page).toHaveURL(
      new RegExp(`/audience\\?segmentId=${seeded.segmentId}`),
    );
    await expect(page.locator("select").first()).toHaveValue(seeded.segmentId);

    await page.goto("/audience/segments");
    await page.getByRole("button", { name: "Create segment" }).click();
    await expect(
      page.getByRole("heading", { name: "Create a new segment" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).click();

    const segmentRow = page.locator("tr", { hasText: seeded.segmentName });
    await segmentRow.hover();
    await segmentRow.getByRole("button", { name: "More actions" }).click();
    await page.getByRole("button", { name: "Delete segment" }).click();
    await page
      .getByRole("dialog", { name: "Delete segment" })
      .getByRole("button", { name: "Cancel" })
      .click();
  });

  await test.step("properties inventory: search/type inputs, create modal, and destructive row action", async () => {
    await page.goto("/audience/properties");
    await expect(
      page.getByRole("button", { name: "Add property" }),
    ).toBeVisible();
    await expect(page.getByText(seeded.propertyName)).toBeVisible();
    await expect(page.locator("select").first()).toContainText("String");
    await expect(page.locator("select").first()).toContainText("Number");

    await page.getByPlaceholder("Search...").fill(seeded.propertyKey);
    await expect(page.getByText(seeded.propertyName)).toBeVisible();

    await page.getByRole("button", { name: "Add property" }).click();
    await expect(
      page.getByRole("heading", { name: "Add a new property" }),
    ).toBeVisible();
    await expect(page.getByLabel("Name")).toBeVisible();
    await expect(page.getByLabel("Type")).toBeVisible();
    await expect(page.getByLabel("Fallback Value")).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).click();

    const propertyRow = page.locator("tr", { hasText: seeded.propertyName });
    await propertyRow.hover();
    await propertyRow.getByRole("button", { name: "More actions" }).click();
    await page.getByRole("button", { name: "Delete property" }).click();
    await page
      .getByRole("dialog", { name: "Delete property" })
      .getByRole("button", { name: "Cancel" })
      .click();
  });

  await test.step("topics inventory: filters, preview, unavailable editor route, create modal, and destructive row action", async () => {
    await page.goto("/audience/topics");
    await expect(
      page.getByRole("button", { name: "Create topic" }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Edit Unsubscribe Page" }),
    ).toHaveAttribute("href", "/audience/topics/unsubscribe-page/edit");
    await expect(page.getByText("Unsubscribe Page Preview")).toBeVisible();
    await expect(page.getByText(seeded.topicName)).toBeVisible();
    await expect(page.locator("select").first()).toContainText("Opt-in");
    await expect(page.locator("select").first()).toContainText("Opt-out");

    await page.getByRole("button", { name: "Create topic" }).first().click();
    await expect(
      page.getByRole("heading", { name: "Create a new topic" }),
    ).toBeVisible();
    await expect(page.getByLabel("Name")).toBeVisible();
    await expect(page.getByLabel("Description")).toBeVisible();
    await expect(page.getByLabel("Defaults to")).toBeVisible();
    await expect(page.getByLabel("Visibility")).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).click();

    const topicRow = page.locator("tr", { hasText: seeded.topicName });
    await topicRow.hover();
    await topicRow.getByRole("button", { name: "More actions" }).click();
    await page.getByRole("button", { name: "Delete topic" }).click();
    await page
      .getByRole("dialog", { name: "Delete topic" })
      .getByRole("button", { name: "Cancel" })
      .click();
  });

  expect(pageErrors).toEqual([]);
});
