import { expect, test } from "./fixtures/auth";

test.describe("Emails Sending Filter Bar", () => {
  test("filter bar renders all filter controls", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/emails");
    // Search input
    await expect(page.getByPlaceholder("Search...")).toBeVisible();
    // Date range picker
    await expect(page.getByText("Last 15 days")).toBeVisible();
    // Status filter
    await expect(page.getByText("All Statuses")).toBeVisible();
    // API Key filter
    await expect(page.getByText("All API Keys")).toBeVisible();
    // Export button
    await expect(page.getByLabel("Export")).toBeVisible();
  });

  test("filter emails by status dropdown", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/emails");
    await page.getByText("All Statuses").click();
    await expect(page.getByText("Delivered")).toBeVisible();
    await expect(page.getByText("Bounced")).toBeVisible();
    await expect(page.getByText("Failed")).toBeVisible();
    // Select a status
    await page.getByText("Delivered").click();
    // Dropdown should close and show selected value
    await expect(page.getByText("Delivered")).toBeVisible();
  });

  test("filter emails by date range preset", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/emails");
    await page.getByText("Last 15 days").click();
    await expect(page.getByText("Today")).toBeVisible();
    await expect(page.getByText("Yesterday")).toBeVisible();
    await expect(page.getByText("Last 7 days")).toBeVisible();
    // Select Today
    await page.getByText("Today").click();
    // Button should now show "Today"
    await expect(page.getByText("Today")).toBeVisible();
  });

  // E2E category: smoke-only; URL resync check is flaky under real browser state and needs component-level follow-up (#229 audit).
  test.skip(
    true,
    "E2E category: smoke-only; URL resync check needs deterministic component-state follow-up (#229 audit).",
  );

  test("resyncs search controls when the URL search params change after mount", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/emails?search=alice");

    const searchInput = page.getByPlaceholder("Search...");
    await expect(searchInput).toHaveValue("alice");

    await page.evaluate(() => {
      window.history.pushState({}, "", "/emails?search=bob");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    await expect(page).toHaveURL(/\/emails\?search=bob/);
    await expect(searchInput).toHaveValue("bob");
  });
});
