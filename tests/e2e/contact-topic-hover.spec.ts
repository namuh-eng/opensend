import { expect, test } from "./fixtures/auth";

test.describe("Contact topic hover", () => {
  test("shows topic names from the subscribed status badge", async ({
    authenticatedPage: page,
    e2eApiRequest,
    e2eRunId,
  }) => {
    const topicOne = await e2eApiRequest.post("/api/topics", {
      data: {
        name: "product update",
        description: "Product release emails",
        default_subscription: "opt_in",
        visibility: "public",
      },
    });
    expect(topicOne.status()).toBe(201);
    const topicOneBody = (await topicOne.json()) as { id: string };

    const topicTwo = await e2eApiRequest.post("/api/topics", {
      data: {
        name: "test",
        description: "Test send announcements",
        default_subscription: "opt_out",
        visibility: "public",
      },
    });
    expect(topicTwo.status()).toBe(201);
    const topicTwoBody = (await topicTwo.json()) as { id: string };

    const email = `topic-hover-${e2eRunId}@${e2eRunId}.e2e.opensend.test`;
    const contactResponse = await e2eApiRequest.post("/api/contacts", {
      data: {
        email,
        first_name: "Topic",
        last_name: "Hover",
        properties: { test_run_id: e2eRunId },
        topics: [
          { id: topicOneBody.id, subscription: "opt_in" },
          { id: topicTwoBody.id, subscription: "opt_out" },
        ],
      },
    });
    expect(contactResponse.status()).toBe(201);

    await page.goto("/audience");

    const contactRow = page.locator("tr", { hasText: email });
    await expect(contactRow).toBeVisible();
    const subscribedBadge = contactRow.getByRole("button", {
      name: "Subscribed to 2 topics",
    });
    await expect(subscribedBadge).toBeVisible();
    await subscribedBadge.hover();

    const topicsTooltip = page.getByRole("tooltip", { name: "Topics" });
    await expect(topicsTooltip).toBeVisible();
    await expect(topicsTooltip.getByText("product update")).toBeVisible();
    await expect(
      topicsTooltip.getByText("test", { exact: true }),
    ).toBeVisible();
  });
});
