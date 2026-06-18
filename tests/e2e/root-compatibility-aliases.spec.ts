import { expect, test } from "@playwright/test";

test("root compatibility aliases route API-like requests while preserving dashboard pages", async ({
  page,
  request,
}) => {
  for (const dashboardPath of ["/domains", "/webhooks", "/logs", "/emails"]) {
    await page.goto(dashboardPath);
    await expect(page).toHaveURL(/\/auth$/);
  }

  for (const apiPath of [
    "/domains",
    "/webhooks",
    "/topics",
    "/contact-properties",
    "/logs",
    "/emails",
    "/events",
  ]) {
    const response = await request.get(apiPath, {
      headers: { accept: "application/json" },
    });
    expect(response.status(), apiPath).toBe(401);
    expect(response.headers()["content-type"]).toContain("application/json");
  }
});
