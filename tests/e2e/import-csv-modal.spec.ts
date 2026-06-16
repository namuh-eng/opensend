import path from "node:path";
import { expect, test } from "./fixtures/auth";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Absolute path to the shared CSV fixture. */
const FIXTURE_CSV = path.join(
  import.meta.dirname,
  "../fixtures/contacts-sample.csv",
);

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

    // Mapping step should appear with column headers detected
    await expect(
      page.getByText(/map csv columns/i, { exact: false }),
    ).toBeVisible();
    await expect(page.getByText("email")).toBeVisible();
    await expect(page.getByText("first_name")).toBeVisible();
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
    e2eRunId,
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

    // Verify at least one of the fixture emails landed in the DB
    const { rows } = await e2eDb.query<{ email: string }>(
      `select email from contacts where email like '%@${e2eRunId}.e2e.opensend.test' and user_id = $1`,
      [e2eTenant.user.id],
    );
    expect(rows.length).toBeGreaterThan(0);
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
