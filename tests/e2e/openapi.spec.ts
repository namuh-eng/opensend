import { expect, test } from "@playwright/test";

test("publishes public OpenAPI and styled docs without sign-in", async ({
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
  await expect(
    page.getByRole("heading", { name: "Email infrastructure docs" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "OpenAPI" }).first(),
  ).toHaveAttribute("href", "/openapi.json");
  await expect(
    page.getByRole("link", { name: "Self-hosting guide" }),
  ).toHaveAttribute("href", "/docs/self-hosting");

  await page.goto("/docs/self-hosting");
  await expect(
    page.getByRole("heading", { name: "Self Hosting" }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Reference topology" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Raw markdown" }),
  ).toHaveAttribute("href", "/docs/self-hosting.md");

  const llms = await request.get("/docs/llms.txt");
  expect(llms.status()).toBe(200);
  const llmsText = await llms.text();
  expect(llmsText).toContain(
    "https://opensend.namuh.co/docs/api-reference/introduction.md",
  );
  expect(llmsText).not.toContain("api.opensend.com");
});
