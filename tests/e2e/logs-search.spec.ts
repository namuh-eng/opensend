import { expect, test } from "@playwright/test";

test("logs dashboard exposes URL-backed search", async ({ page }) => {
  test.skip(
    !process.env.DATABASE_URL,
    "DATABASE_URL is required for dashboard logs",
  );
  await page.goto("/logs?q=email-issue-224");
  if (page.url().includes("/auth")) {
    test.skip(true, "dashboard auth is required for logs search UI");
  }

  const search = page.getByRole("searchbox", { name: "Search logs" });
  await expect(search).toBeVisible();
  await expect(search).toHaveValue("email-issue-224");
  await search.fill("POST /api/emails");
  await expect(page).toHaveURL(
    /q=POST\+%2Fapi%2Femails|q=POST%20%2Fapi%2Femails/,
  );
});
