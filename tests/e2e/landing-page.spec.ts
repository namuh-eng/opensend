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
          name: /email infrastructure/i,
        }),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: /none of the lock-in/i }),
      ).toBeVisible();
      await expect(page.getByTestId("cta-self-host")).toBeVisible();
      await expect(page.getByTestId("cta-hosted")).toBeVisible();
    });

    test("renders the developer code sample, comparison, self-host quickstart, and roadmap", async ({
      page,
    }) => {
      await page.goto(route);

      await expect(page.getByLabel("TypeScript SDK code sample")).toContainText(
        "send.emails.send",
      );
      await expect(
        page.getByRole("heading", { name: /cloud, or yours/i }),
      ).toBeVisible();
      await expect(page.getByText(/option B · default/i)).toBeVisible();
      await expect(
        page.getByText("docker compose up -d").first(),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: /shipping in public/i }),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: /stop renting your/i }),
      ).toBeVisible();
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

test("pricing billing toggle updates selected period and plan prices", async ({
  page,
}) => {
  await page.goto("/pricing");

  await expect(page.getByTestId("billing-monthly")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByTestId("plan-starter")).toContainText(
    /\$\s*19\s*\/mo/,
  );
  await expect(page.getByTestId("plan-growth")).toContainText(/\$\s*79\s*\/mo/);

  await page.getByTestId("billing-yearly").click();

  await expect(page).toHaveURL(/\/pricing\?billing=yearly$/);
  await expect(page.getByTestId("billing-yearly")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByTestId("plan-starter")).toContainText(
    /\$\s*15\s*\/mo/,
  );
  await expect(page.getByTestId("plan-growth")).toContainText(/\$\s*65\s*\/mo/);
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
