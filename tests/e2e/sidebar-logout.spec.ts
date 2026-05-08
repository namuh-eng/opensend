import { expect, test } from "@playwright/test";
// E2E category: mocked browser integration; security-adjacent sign-out needs real Better Auth follow-up (#229 audit).
test.skip(
  true,
  "E2E category: mocked browser integration; security-adjacent sign-out needs real Better Auth follow-up (#229 audit).",
);

test("signed-in dashboard user can sign out and protected routes redirect to auth", async ({
  context,
  page,
}) => {
  await context.addCookies([
    {
      name: "better-auth.session_token",
      value: "e2e-session-token",
      domain: "localhost",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);

  await page.route("**/api/auth/get-session", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        session: { id: "e2e-session", token: "e2e-session-token" },
        user: { id: "e2e-user", email: "e2e@example.com", name: "E2E User" },
      }),
    });
  });

  await page.route("**/api/auth/sign-out", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: {
        "set-cookie":
          "better-auth.session_token=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax",
      },
      body: JSON.stringify({ success: true }),
    });
  });

  await page.goto("/emails");
  await expect(page).toHaveURL(/\/emails/);
  await expect(page.getByText("e2e@example.com")).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(
    page.getByRole("button", { name: "Signing out..." }),
  ).toBeDisabled();
  await expect(page).toHaveURL(/\/auth$/);
  await expect(
    page.getByRole("heading", { name: "Sign in to OpenSend" }),
  ).toBeVisible();

  await page.goto("/emails");
  await expect(page).toHaveURL(/\/auth$/);
});
