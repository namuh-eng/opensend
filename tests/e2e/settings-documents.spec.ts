// ABOUTME: E2E tests for Settings Team/Documents tabs — verifies live team actions and OpenSend document copy

import { expect, test } from "./fixtures/auth";

test.describe("Settings Team and Documents Page", () => {
  test("team tab exposes live member management controls", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/settings");

    await page.getByRole("button", { name: "Team" }).click();

    await expect(
      page.getByText(/Invitation email delivery is not automatic/),
    ).toBeVisible();

    await expect(
      page.getByRole("button", { name: "Invite member" }),
    ).toBeDisabled();
    await expect(page.getByLabel("Invite email")).toBeVisible();
    await expect(page.getByLabel("Invitation token")).toBeVisible();
  });

  test("documents tab avoids Resend branding and marks unavailable docs", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/settings");

    await page.getByRole("button", { name: "Documents" }).click();

    await expect(
      page.getByRole("heading", { name: "Penetration test" }),
    ).toBeVisible();
    await expect(
      page.locator("text=/Penetration testing is performed/"),
    ).toBeVisible();

    await expect(page.getByRole("heading", { name: "SOC 2" })).toBeVisible();
    await expect(page.locator("text=/OpenSend-specific report/")).toBeVisible();

    await expect(page.getByRole("heading", { name: "DPA" })).toBeVisible();
    await expect(
      page.locator("text=/self-service DPA download/"),
    ).toBeVisible();

    await expect(page.getByRole("heading", { name: "Form W-9" })).toBeVisible();
    await expect(page.locator("text=/tax document/")).toBeVisible();

    await expect(page.locator("body")).not.toContainText("Resend");
    await expect(page.getByText("Unavailable")).toHaveCount(2);

    const downloadLinks = page.locator('a:has-text("Download")');
    await expect(downloadLinks).toHaveCount(2);
    for (let i = 0; i < 2; i++) {
      const href = await downloadLinks.nth(i).getAttribute("href");
      expect(href).toContain("/static/documents/");
      expect(href).toMatch(/\.pdf$/);
    }
  });
});
