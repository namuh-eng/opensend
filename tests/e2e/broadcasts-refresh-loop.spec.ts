import { expect, test } from "./fixtures/auth";

test.describe("Broadcasts dashboard navigation", () => {
  test("keeps /broadcasts on the dashboard without repeated hard navigations", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/broadcasts");
    await expect(
      page.getByRole("heading", { exact: true, name: "Broadcasts" }),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/broadcasts$/);

    const initialTimeOrigin = await page.evaluate(() => performance.timeOrigin);

    await page.waitForTimeout(4_000);

    await expect(page).toHaveURL(/\/broadcasts$/);
    await expect(
      page.getByRole("heading", { exact: true, name: "Broadcasts" }),
    ).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => performance.timeOrigin))
      .toBe(initialTimeOrigin);
  });
});
