import { expect, test } from "./fixtures/auth";

test.describe("Topics unsubscribe page customization", () => {
  test("links to the live customization page from the Topics page", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/audience/topics");

    await expect(page.getByText("Unsubscribe Page Preview")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Customize page" }),
    ).toHaveAttribute("href", "/audience/topics/unsubscribe-page/edit");
    await expect(
      page.getByRole("button", { name: "Unsubscribe" }),
    ).toBeDisabled();
    await page.getByRole("button", { name: "Success" }).click();
    await expect(
      page.getByText("Your email preferences were updated."),
    ).toBeVisible();
  });

  test("renders the live editor for direct editor deep links", async ({
    authenticatedPage: page,
    e2eApiRequest,
  }) => {
    await e2eApiRequest.post("/api/topics", {
      data: {
        name: "product update",
        description: "product update",
        defaultSubscription: "opt_in",
        visibility: "public",
      },
    });
    await e2eApiRequest.post("/api/topics", {
      data: {
        name: "test topic",
        description: "test",
        defaultSubscription: "opt_out",
        visibility: "public",
      },
    });

    await page.goto("/audience/topics/unsubscribe-page/edit");

    await expect(
      page.getByRole("heading", {
        name: "Unsubscribe page customization",
      }),
    ).toBeVisible();
    await expect(
      page.getByText(
        "Customize the hosted preference page your contacts see after clicking an unsubscribe link.",
      ),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Preferences", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Success", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Edit" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    await expect(
      page.getByRole("link", { name: "Topics" }).last(),
    ).toHaveAttribute("href", "/audience/topics");
    await expect(page.getByText("Subscription preferences")).toBeVisible();
    await expect(page.getByText("product update").first()).toBeVisible();
    await expect(page.getByText("test topic")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Update preferences", exact: true }),
    ).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Unsubscribe from all", exact: true }),
    ).toBeDisabled();
    await page.getByRole("button", { name: "Success", exact: true }).click();
    await expect(page.getByText("Unsubscribed successfully")).toBeVisible();
    await page.getByRole("button", { name: "Edit" }).click();
    await expect(page.getByLabel("Headline")).toBeVisible();
  });

  test("renders the live editor from the Settings unsubscribe page tab", async ({
    authenticatedPage: page,
    e2eApiRequest,
  }) => {
    await e2eApiRequest.post("/api/topics", {
      data: {
        name: "product update",
        description: "product update",
        defaultSubscription: "opt_in",
        visibility: "public",
      },
    });
    await e2eApiRequest.post("/api/topics", {
      data: {
        name: "test topic",
        description: "test",
        defaultSubscription: "opt_out",
        visibility: "public",
      },
    });

    await page.goto("/settings");

    await page.getByRole("button", { name: "Unsubscribe Page" }).click();

    await expect(
      page.getByRole("button", { name: "Preferences", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Success", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Edit" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    await expect(page.getByText("Subscription preferences")).toBeVisible();
    await expect(page.getByText("product update").first()).toBeVisible();
    await expect(page.getByText("test topic")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Update preferences", exact: true }),
    ).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Unsubscribe from all", exact: true }),
    ).toBeDisabled();

    await page.getByRole("button", { name: "Success", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Preferences", exact: true }),
    ).toHaveAttribute("aria-pressed", "false");
    await expect(
      page.getByRole("button", { name: "Success", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("Unsubscribed successfully")).toBeVisible();
  });
});
