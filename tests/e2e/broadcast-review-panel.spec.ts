import { expect, test } from "./fixtures/auth";
// E2E category: smoke-only; broadcast review test needs deterministic broadcast fixture follow-up (#229 audit).
test.skip(
  true,
  "E2E category: smoke-only; broadcast review test needs deterministic broadcast fixture follow-up (#229 audit).",
);

test.describe("Broadcast Review Panel", () => {
  test("open and close review panel", async ({ authenticatedPage: page }) => {
    // Create a broadcast
    const res = await page.request.post("/api/broadcasts", {
      data: { name: "Review Test" },
    });
    const broadcast = await res.json();

    // Navigate to editor
    await page.goto(`/broadcasts/${broadcast.id}/editor`);
    await page.waitForSelector('input[value="Review Test"]');

    // Click Review button
    const reviewButton = page.locator("button", { hasText: "Review" });
    await reviewButton.click();

    // Verify review panel appears with "Ready to send?"
    const panel = page.locator('[data-testid="review-panel"]');
    await expect(panel).toBeVisible();
    await expect(panel.locator("text=Ready to send?")).toBeVisible();

    // Verify slide-to-send slider is present
    const slider = panel.locator('input[type="range"]');
    await expect(slider).toBeVisible();
    await expect(slider).toHaveAttribute("min", "0");
    await expect(slider).toHaveAttribute("max", "100");

    // Click Review button again to close
    await reviewButton.click();
    await expect(panel).not.toBeVisible();

    // Cleanup
    await page.request.delete(`/api/broadcasts/${broadcast.id}`);
  });
});
