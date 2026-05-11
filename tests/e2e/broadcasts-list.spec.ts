import { expect, test } from "./fixtures/auth";
// E2E category: smoke-only; broadcasts list tests need deterministic broadcast fixture follow-up (#229 audit).
test.skip(
  true,
  "E2E category: smoke-only; broadcasts list tests need deterministic broadcast fixture follow-up (#229 audit).",
);

test.describe("Broadcasts list page", () => {
  test("navigate to broadcast editor from list", async ({
    authenticatedPage: page,
  }) => {
    // Create a broadcast first
    const res = await page.request.post("/api/broadcasts", {
      data: { name: "Test Broadcast" },
    });
    const broadcast = await res.json();

    await page.goto("/broadcasts");
    await expect(page.getByText("Test Broadcast")).toBeVisible();

    // Click on broadcast name
    await page.getByText("Test Broadcast").click();
    await page.waitForURL(`/broadcasts/${broadcast.id}/editor`);
    expect(page.url()).toContain(`/broadcasts/${broadcast.id}/editor`);

    // Cleanup
    await page.request.delete(`/api/broadcasts/${broadcast.id}`);
  });

  test("filter broadcasts by status", async ({ authenticatedPage: page }) => {
    // Create a draft broadcast
    const res = await page.request.post("/api/broadcasts", {
      data: { name: "Draft Filter Test" },
    });
    const broadcast = await res.json();

    await page.goto("/broadcasts");
    await expect(page.getByText("Draft Filter Test")).toBeVisible();

    // Click status dropdown
    await page.getByText("All Statuses").click();
    await page.getByRole("menuitem", { name: "Sent" }).click();

    // Draft broadcast should no longer be visible
    await expect(page.getByText("Draft Filter Test")).not.toBeVisible();

    // Cleanup
    await page.request.delete(`/api/broadcasts/${broadcast.id}`);
  });

  test("create email button creates broadcast", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/broadcasts");

    await page.getByText("Create email").click();

    // Should navigate to editor for new broadcast
    await page.waitForURL(/\/broadcasts\/.*\/editor/);
    expect(page.url()).toMatch(/\/broadcasts\/.*\/editor/);
  });
});
