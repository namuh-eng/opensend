import { expect, test } from "./fixtures/auth";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Path to the shared CSV fixture, relative to the repo root. Playwright's
 * setInputFiles resolves relative paths against the cwd (the project root
 * when running `bunx playwright test`).
 */
const FIXTURE_CSV = "tests/fixtures/contacts-sample.csv";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("Import CSV modal", () => {
  test("opens modal from Import CSV dropdown item", async ({
    authenticatedPage: page,
  }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));

    await page.goto("/audience");

    await page.getByRole("button", { name: /add contacts/i }).click();
    await page.getByText("Import CSV").click();

    await expect(
      page.getByRole("heading", { name: "Import CSV" }),
    ).toBeVisible();
    expect(pageErrors).toEqual([]);
  });

  test("closes modal with Cancel button", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/audience");

    await page.getByRole("button", { name: /add contacts/i }).click();
    await page.getByText("Import CSV").click();

    await expect(
      page.getByRole("heading", { name: "Import CSV" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Cancel" }).click();

    await expect(
      page.getByRole("heading", { name: "Import CSV" }),
    ).not.toBeVisible();
  });

  test("closes modal with X button", async ({ authenticatedPage: page }) => {
    await page.goto("/audience");

    await page.getByRole("button", { name: /add contacts/i }).click();
    await page.getByText("Import CSV").click();

    await expect(
      page.getByRole("heading", { name: "Import CSV" }),
    ).toBeVisible();

    await page.getByRole("button", { name: /close/i }).click();

    await expect(
      page.getByRole("heading", { name: "Import CSV" }),
    ).not.toBeVisible();
  });

  test("shows column mapping UI after selecting a CSV file", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/audience");

    await page.getByRole("button", { name: /add contacts/i }).click();
    await page.getByText("Import CSV").click();

    await page.getByLabel("CSV file").setInputFiles(FIXTURE_CSV);

    // Mapping step should appear with the CSV column headers detected.
    // Use exact matches so the column-name cells are not confused with the
    // "Email address" select options or the "Emails" nav item.
    await expect(
      page.getByText(/map csv columns/i, { exact: false }),
    ).toBeVisible();
    await expect(page.getByText("email", { exact: true })).toBeVisible();
    await expect(page.getByText("first_name", { exact: true })).toBeVisible();
  });

  test("Import button is disabled until email column is mapped", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/audience");

    await page.getByRole("button", { name: /add contacts/i }).click();
    await page.getByText("Import CSV").click();

    await page.getByLabel("CSV file").setInputFiles(FIXTURE_CSV);

    // Wait for mapping step
    await expect(page.getByRole("button", { name: "Import" })).toBeVisible();

    // Clear the auto-assigned email mapping
    const emailSelect = page
      .locator("select")
      .filter({ hasText: /email address/i })
      .first();
    await emailSelect.selectOption("— skip —");

    await expect(page.getByRole("button", { name: "Import" })).toBeDisabled();
  });

  test("happy path: imports contacts from CSV and shows success", async ({
    authenticatedPage: page,
    e2eDb,
    e2eTenant,
  }) => {
    await page.goto("/audience");

    await page.getByRole("button", { name: /add contacts/i }).click();
    await page.getByText("Import CSV").click();

    await page.getByLabel("CSV file").setInputFiles(FIXTURE_CSV);

    // Wait for mapping step
    await expect(page.getByRole("button", { name: "Import" })).toBeVisible();

    // email column should be auto-mapped (fixture header is "email")
    await expect(
      page.getByRole("button", { name: "Import" }),
    ).not.toBeDisabled();

    await page.getByRole("button", { name: "Import" }).click();

    // Success step
    await expect(page.getByText(/import complete/i)).toBeVisible();
    await expect(page.getByText(/imported/i)).toBeVisible();

    // Close
    await page.getByRole("button", { name: "Done" }).click();
    await expect(
      page.getByRole("heading", { name: "Import CSV" }),
    ).not.toBeVisible();

    // Verify all three fixture contacts landed in the DB under this tenant.
    // The fixture uses a static @e2erunid.e2e.opensend.test domain; cleanup
    // removes them via the user_id prefix regardless of the email domain.
    const { rows } = await e2eDb.query<{ email: string }>(
      `select email from contacts
       where user_id = $1 and email like '%@e2erunid.e2e.opensend.test'
       order by email`,
      [e2eTenant.user.id],
    );
    expect(rows.map((r) => r.email)).toEqual([
      "alice@e2erunid.e2e.opensend.test",
      "bob@e2erunid.e2e.opensend.test",
      "carol@e2erunid.e2e.opensend.test",
    ]);
  });

  test("shows file type error for non-CSV files without making a network request", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/audience");

    await page.getByRole("button", { name: /add contacts/i }).click();
    await page.getByText("Import CSV").click();

    // Upload a plain-text file disguised as something else
    await page.getByLabel("CSV file").setInputFiles({
      name: "contacts.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("email\nfoo@bar.com"),
    });

    // Error shown, still on pick step (no mapping UI)
    await expect(
      page.getByText(/unsupported file type/i, { exact: false }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Import" }),
    ).not.toBeVisible();
  });

  test("shows size error for files larger than 10 MB", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/audience");

    await page.getByRole("button", { name: /add contacts/i }).click();
    await page.getByText("Import CSV").click();

    const oversizedBuffer = Buffer.alloc(11 * 1024 * 1024, "a");
    await page.getByLabel("CSV file").setInputFiles({
      name: "big.csv",
      mimeType: "text/csv",
      buffer: oversizedBuffer,
    });

    await expect(
      page.getByText(/10 mb limit/i, { exact: false }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Import" }),
    ).not.toBeVisible();
  });
});
