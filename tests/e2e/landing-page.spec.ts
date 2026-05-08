import { expect, test } from "./fixtures/auth";

for (const route of ["/", "/landing"] as const) {
  test.describe(`Landing page at ${route}`, () => {
    test("renders public hero, features, and dual CTAs without auth redirect", async ({
      page,
    }) => {
      await page.goto(route);
      await expect(page).toHaveURL(
        new RegExp(`${route === "/" ? "/$" : "/landing$"}`),
      );
      await expect(
        page.getByRole("heading", {
          level: 1,
          name: /open-source email API/i,
        }),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: /What's in the box/i }),
      ).toBeVisible();
      await expect(page.getByTestId("cta-self-host")).toBeVisible();
      await expect(page.getByTestId("cta-hosted")).toBeVisible();
    });

    test("renders the developer code sample, comparison table, dashboard screenshot, and FAQ", async ({
      page,
    }) => {
      await page.goto(route);

      await expect(page.getByLabel("TypeScript SDK code sample")).toContainText(
        "opensend.emails.send",
      );
      await expect(
        page.getByRole("table", {
          name: /comparison of opensend, resend, and postmark/i,
        }),
      ).toBeVisible();
      await expect(
        page.getByRole("columnheader", { name: "Postmark" }),
      ).toBeVisible();
      await expect(
        page.getByRole("img", { name: /opensend dashboard/i }),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: /frequently asked questions/i }),
      ).toBeVisible();
      await expect(
        page.getByText(/What does the Elastic License 2\.0 allow/i),
      ).toBeVisible();
      await expect(page.getByText(/Do I need AWS SES/i)).toBeVisible();
      await expect(page.getByText(/self-host or use hosted/i)).toBeVisible();
      await expect(page.getByText(/migrate from Resend-style/i)).toBeVisible();
    });
  });
}

test("self-host CTA points at the OpenSend GitHub repo", async ({ page }) => {
  await page.goto("/");
  const selfHost = page.getByTestId("cta-self-host");
  await expect(selfHost).toBeVisible();
  const href = await selfHost.getAttribute("href");
  expect(href).toContain("github.com/namuh-eng/opensend");
});

test("hosted CTA navigates to the auth page", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("cta-hosted").click();
  await expect(page).toHaveURL(/\/auth$/);
});

test("unauthenticated dashboard routes remain protected", async ({ page }) => {
  await page.goto("/emails");
  await expect(page).toHaveURL(/\/auth$/);
});

test("authenticated root redirects to /emails", async ({
  authenticatedPage,
}) => {
  await authenticatedPage.goto("/");
  await expect(authenticatedPage).toHaveURL(/\/emails$/);
});
