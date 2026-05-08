import { expect, test } from "./fixtures/auth";

const NAV_ITEMS = [
  { label: "Emails", path: "/emails" },
  { label: "Broadcasts", path: "/broadcasts" },
  { label: "Automations", path: "/automations" },
  { label: "Templates", path: "/templates" },
  { label: "Audience", path: "/audience" },
  { label: "Metrics", path: "/metrics" },
  { label: "Domains", path: "/domains" },
  { label: "Logs", path: "/logs" },
  { label: "API Keys", path: "/api-keys" },
  { label: "Webhooks", path: "/webhooks" },
  { label: "Settings", path: "/settings" },
];

test("sidebar renders with all nav items", async ({
  authenticatedPage: page,
}) => {
  await page.goto("/");
  const sidebar = page.locator("nav");
  for (const item of NAV_ITEMS) {
    await expect(sidebar.getByRole("link", { name: item.label })).toBeVisible();
  }
});

test("navigate between pages via sidebar", async ({
  authenticatedPage: page,
}) => {
  await page.goto("/");

  // Click Emails
  await page.getByRole("link", { name: "Emails" }).click();
  await expect(page).toHaveURL(/\/emails/);
  await expect(page.getByRole("heading", { name: "Emails" })).toBeVisible();

  // Click Domains
  await page.getByRole("link", { name: "Domains" }).click();
  await expect(page).toHaveURL(/\/domains/);
  await expect(page.getByRole("heading", { name: "Domains" })).toBeVisible();
});

test("active nav item is highlighted", async ({ authenticatedPage: page }) => {
  await page.goto("/emails");
  const emailsLink = page.getByRole("link", { name: "Emails" });
  await expect(emailsLink).toHaveAttribute("data-active", "true");
});

test("home page redirects to emails", async ({ authenticatedPage: page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/emails/);
});

test("sidebar is persistent across navigation", async ({
  authenticatedPage: page,
}) => {
  await page.goto("/emails");
  const sidebar = page.locator("nav");
  await expect(sidebar).toBeVisible();

  await page.getByRole("link", { name: "Domains" }).click();
  await expect(sidebar).toBeVisible();
  await expect(page).toHaveURL(/\/domains/);
  await expect(page.getByRole("heading", { name: "Domains" })).toBeVisible();

  await page.getByRole("link", { name: "API Keys" }).click();
  await expect(sidebar).toBeVisible();
  await expect(page).toHaveURL(/\/api-keys/);
  await expect(
    page.getByRole("heading", { name: "API Keys", exact: true }),
  ).toBeVisible();
});

test("footer exposes feedback, help, and docs links", async ({
  authenticatedPage: page,
}) => {
  await page.goto("/emails");

  const footer = page.locator("footer");
  await expect(footer).toBeVisible();
  await expect(footer.getByRole("link", { name: "Feedback" })).toHaveAttribute(
    "href",
    "mailto:feedback@example.com?subject=Opensend%20Feedback",
  );
  await expect(footer.getByRole("link", { name: "Help" })).toHaveAttribute(
    "href",
    "mailto:help@example.com?subject=Opensend%20Help",
  );
  await expect(footer.getByRole("link", { name: "Docs" })).toHaveAttribute(
    "href",
    "/docs",
  );
});
