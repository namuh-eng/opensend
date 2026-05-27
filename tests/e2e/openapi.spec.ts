import { expect, test } from "@playwright/test";

test("publishes public OpenAPI and styled docs without sign-in", async ({
  page,
  request,
}) => {
  const response = await request.get("/openapi.json");
  expect(response.status()).toBe(200);

  const openApiDocument = (await response.json()) as {
    openapi?: string;
    paths?: Record<string, unknown>;
  };
  expect(openApiDocument.openapi).toMatch(/^3\./);
  const paths = openApiDocument.paths ?? {};
  expect(paths).toHaveProperty("/emails");
  expect(
    Object.keys((paths["/emails"] as Record<string, unknown>) ?? {}).sort(),
  ).toEqual(["get", "post"]);
  expect(paths).toHaveProperty("/emails/batch");
  expect(paths).toHaveProperty("/domains");
  expect(paths).toHaveProperty("/webhooks");
  expect(paths).toHaveProperty("/topics");
  expect(paths).toHaveProperty("/contact-properties");
  expect(paths).toHaveProperty("/logs");
  expect(paths).toHaveProperty("/api/domains");

  await page.setViewportSize({ width: 1920, height: 1200 });
  await page.goto("/docs");
  await expect(page).toHaveTitle("OpenSend Docs");
  await expect(
    page.getByRole("heading", { name: "Email infrastructure docs" }),
  ).toBeVisible();
  await expect(
    page.getByText("Choose a guide from the sidebar"),
  ).not.toBeVisible();
  await expect
    .poll(async () =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true);
  await expect(
    page.getByRole("link", { name: "OpenAPI" }).first(),
  ).toHaveAttribute("href", "/openapi.json");
  await expect(
    page.getByRole("link", { name: "SDKs" }).first(),
  ).toHaveAttribute("href", "/docs/sdks");
  await expect(
    page.getByRole("link", { name: "Self-hosting guide" }),
  ).toHaveAttribute("href", "/docs/self-hosting");
  await expect
    .poll(async () =>
      page
        .getByRole("link", { name: "Send your first email", exact: true })
        .evaluate((link) => getComputedStyle(link).color),
    )
    .toBe("rgb(10, 10, 12)");

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

  await page.goto("/docs/examples");
  const examplesArticle = page.locator("article");
  await expect(
    examplesArticle.getByRole("heading", { name: "Examples" }).first(),
  ).toBeVisible();
  await expect(
    examplesArticle.getByRole("link", { name: /Send one email with/ }),
  ).toHaveAttribute(
    "href",
    "https://github.com/namuh-eng/opensend/tree/main/examples/npm-send-email",
  );
  const nodeQuickstartLink = examplesArticle.getByRole("link", {
    name: "Node.js",
    exact: true,
  });
  await expect(nodeQuickstartLink).toHaveAttribute(
    "href",
    "/docs/send-with-nodejs",
  );
  await expect
    .poll(async () =>
      nodeQuickstartLink.evaluate((link) => ({
        color: getComputedStyle(link).color,
        decorationLine: getComputedStyle(link).textDecorationLine,
      })),
    )
    .toEqual({
      color: "rgb(196, 255, 90)",
      decorationLine: "underline",
    });
  await nodeQuickstartLink.click();
  await expect(
    page.getByRole("heading", { name: "Send emails with Node.js" }).first(),
  ).toBeVisible();

  await page.goto("/docs/mcp-server");
  await expect(
    page.getByRole("heading", { name: "MCP Server" }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "More in Start here" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /OpenSend CLI/ }).first(),
  ).toHaveAttribute("href", "/docs/cli");
  await expect(
    page.getByRole("link", { name: /AI Onboarding/ }).first(),
  ).toHaveAttribute("href", "/docs/ai-onboarding");

  await page.goto("/docs/webhooks/emails/sent");
  await expect(
    page.getByRole("heading", { name: "email.sent" }).first(),
  ).toBeVisible();
  await expect(
    page.getByText("Choose a guide from the sidebar"),
  ).not.toBeVisible();

  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto("/docs/api-reference/emails/send-email");
  await expect(
    page.getByRole("heading", { name: "Send Email" }).first(),
  ).toBeVisible();
  await expect(page.getByText("Browse documentation")).toBeVisible();
  await page.getByText("Browse documentation").click();
  await expect(
    page.getByRole("link", { name: /Authentication/ }).first(),
  ).toHaveAttribute("href", "/docs/api-reference/authentication");
  await expect
    .poll(async () =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true);

  const llms = await request.get("/docs/llms.txt");
  expect(llms.status()).toBe(200);
  const llmsText = await llms.text();
  expect(llmsText).toContain(
    "https://opensend.namuh.co/docs/api-reference/introduction.md",
  );
  expect(llmsText).not.toContain("api.opensend.com");
});
