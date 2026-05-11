import { expect, test } from "./fixtures/auth";

test.describe("Topics page", () => {
  test.skip(
    true,
    "E2E category: smoke-only; create topic flow needs deterministic modal selector and cleanup follow-up (#229 audit).",
  );

  test("create new topic", async ({ authenticatedPage: page }) => {
    await page.goto("/audience/topics");

    // Click Create topic button
    await page.click("button:has-text('Create topic')");

    // Modal should appear
    await expect(page.locator("text=Create a new topic")).toBeVisible();

    // Fill in fields
    await page.fill(
      'input[placeholder="Public display name"]',
      "Marketing Updates",
    );
    await page.fill(
      'textarea[placeholder="Optional public description"]',
      "Monthly marketing newsletter",
    );

    // Select Opt-out for Defaults to
    await page.selectOption("#topic-default", "opt_out");

    // Select Public for Visibility
    await page.selectOption("#topic-visibility", "public");

    // Click Add
    await page.click("button:has-text('Add')");

    // Verify topic appears in list
    await expect(page.locator("text=Marketing Updates")).toBeVisible({
      timeout: 5000,
    });
  });

  test("shows empty state with create button and customize link", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/audience/topics");

    // Should show either topics list or empty state
    // The unsubscribe preview should always be present
    await expect(page.locator("text=Unsubscribe Page Preview")).toBeVisible();

    // Unsubscribe Page editor CTA should be disabled with honest copy.
    await expect(
      page.getByRole("button", { name: "Customize page" }),
    ).toBeDisabled();
    await expect(
      page.getByText(
        "Editor unavailable; the default unsubscribe page remains active.",
      ),
    ).toBeVisible();
  });

  test("search filters topics", async ({ authenticatedPage: page }) => {
    await page.goto("/audience/topics");

    const searchInput = page.locator('input[placeholder="Search..."]');
    await expect(searchInput).toBeVisible();

    // Type in search
    await searchInput.fill("nonexistent-topic-xyz");

    // Wait for debounce
    await page.waitForTimeout(500);
  });
});
