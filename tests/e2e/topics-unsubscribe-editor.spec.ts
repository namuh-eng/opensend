import { expect, test } from "./fixtures/auth";

test.describe("Topics unsubscribe editor unavailable state", () => {
  test("does not expose broken editor links from the Topics page", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/audience/topics");

    await expect(page.getByText("Unsubscribe Page Preview")).toBeVisible();
    await expect(
      page.locator('a[href="/audience/topics/unsubscribe-page/edit"]'),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Edit Unsubscribe Page" }),
    ).toBeDisabled();
    await expect(
      page
        .getByText(
          "Editor unavailable; the default unsubscribe page remains active.",
        )
        .first(),
    ).toBeVisible();
  });

  test("renders explanatory copy for direct editor deep links", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/audience/topics/unsubscribe-page/edit");

    await expect(
      page.getByRole("heading", {
        name: "Unsubscribe page editor unavailable",
      }),
    ).toBeVisible();
    await expect(
      page.getByText(
        "Opensend still serves the default unsubscribe page for public topics, but dashboard customization is not available yet.",
      ),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Back to topics" }),
    ).toHaveAttribute("href", "/audience/topics");
  });
});
