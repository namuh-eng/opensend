// ABOUTME: E2E test for Metrics page deliverability section — event type filter dropdown interaction

import { expect, test } from "./fixtures/auth";

test.describe("Metrics — Deliverability Rate section", () => {
  test("filter chart by event type", async ({ authenticatedPage: page }) => {
    await page.goto("/metrics");

    // The deliverability section should be visible
    await expect(page.getByText("DELIVERABILITY RATE")).toBeVisible();

    // "All Events" dropdown should be present
    const allEventsBtn = page.getByRole("button", { name: /All Events/i });
    await expect(allEventsBtn).toBeVisible();

    // Click to open the dropdown
    await allEventsBtn.click();

    // All 9 individual event types should be visible in the dropdown
    await expect(page.getByText("Received")).toBeVisible();
    await expect(page.getByText("Delivered")).toBeVisible();
    await expect(page.getByText("Opened")).toBeVisible();
    await expect(page.getByText("Clicked")).toBeVisible();
    await expect(page.getByText("Bounced")).toBeVisible();
    await expect(page.getByText("Complained")).toBeVisible();
    await expect(page.getByText("Unsubscribed")).toBeVisible();
    await expect(page.getByText("Delivery Delayed")).toBeVisible();
    await expect(page.getByText("Failed")).toBeVisible();
    await expect(page.getByText("Suppressed")).toBeVisible();

    // Select "Delivered" — dropdown label should change
    await page.getByText("Delivered").click();
    await expect(
      page.getByRole("button", { name: /Delivered/i }),
    ).toBeVisible();
  });
});
