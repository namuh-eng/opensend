// ABOUTME: E2E tests for Settings Team/Documents tabs — verifies honest disabled actions and OpenSend document copy

import { expect, test } from "./fixtures/auth";

test.describe("Settings Team and Documents Page", () => {
  test("team tab disables unavailable member management actions", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/settings");

    await page.getByRole("button", { name: "Team" }).click();

    await expect(
      page.getByText(/Team invitations and role editing are not available/),
    ).toBeVisible();

    await expect(
      page.getByRole("button", { name: "Invite member" }),
    ).toBeDisabled();

    const editButtons = page.getByRole("button", {
      name: /Edit .* unavailable/,
    });
    await expect(editButtons.first()).toBeDisabled();
    await expect(editButtons).toHaveCount(2);
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
