import { expect, test } from "@playwright/test";

test("publishes the OpenAPI contract without sign-in", async ({
  page,
  request,
}) => {
  const response = await request.get("/openapi.json");
  expect(response.status()).toBe(200);

  const document = (await response.json()) as {
    openapi?: string;
    paths?: Record<string, unknown>;
  };
  expect(document.openapi).toMatch(/^3\./);
  expect(document.paths).toHaveProperty("/emails");
  expect(document.paths).toHaveProperty("/emails/batch");
  expect(document.paths).toHaveProperty("/api/domains");

  await page.goto("/docs");
  await expect(page.getByRole("link", { name: "/openapi.json" })).toBeVisible();
});
