import { expect, test } from "@playwright/test";

test.describe("Landing page", () => {
  test("renders public hero, features, and CTAs without auth redirect", async ({
    page,
  }) => {
    await page.goto("/landing");
    await expect(page).toHaveURL(/\/landing$/);
    await expect(
      page.getByRole("heading", { level: 1, name: /open-source email API/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /What's in the box/i }),
    ).toBeVisible();
  });

  test("self-host CTA points at the OpenSend GitHub repo", async ({ page }) => {
    await page.goto("/landing");
    const selfHost = page.getByTestId("cta-self-host");
    await expect(selfHost).toBeVisible();
    const href = await selfHost.getAttribute("href");
    expect(href).toContain("github.com/namuh-eng/opensend");
  });

  test("hosted CTA navigates to the auth page", async ({ page }) => {
    await page.goto("/landing");
    await page.getByTestId("cta-hosted").click();
    await expect(page).toHaveURL(/\/auth$/);
  });

  test("docs link from landing footer goes to /docs", async ({ page }) => {
    await page.goto("/landing");
    const docsLink = page.locator("footer").getByRole("link", { name: "Docs" });
    await expect(docsLink).toHaveAttribute("href", "/docs");
  });
});
