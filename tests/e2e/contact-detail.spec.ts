import { expect, test } from "./fixtures/auth";

test.describe("Contact detail page", () => {
  test("opens an individual contact from the Audience contacts table", async ({
    authenticatedPage: page,
    e2eApiRequest,
    e2eRunId,
  }) => {
    const email = `contact-detail-${e2eRunId}@${e2eRunId}.e2e.opensend.test`;
    const createResponse = await e2eApiRequest.post("/api/contacts", {
      data: {
        email,
        first_name: "Click",
        last_name: "Through",
        properties: { test_run_id: e2eRunId },
      },
    });
    expect(createResponse.status()).toBe(201);
    const created = (await createResponse.json()) as { id: string };

    await page.goto("/audience");

    const contactLink = page.locator(
      `table tbody a[href="/audience/contacts/${created.id}"]`,
    );
    await expect(contactLink).toBeVisible();
    await contactLink.click();

    await expect(page).toHaveURL(
      new RegExp(`/audience/contacts/${created.id}$`),
    );
    await expect(page.getByRole("heading", { name: email })).toBeVisible();
    await expect(page.getByText("EMAIL ADDRESS")).toBeVisible();
    await expect(page.getByText("STATUS")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Properties" }),
    ).toBeVisible();
    await expect(page.getByText("Lost in transit")).toHaveCount(0);
  });
});
