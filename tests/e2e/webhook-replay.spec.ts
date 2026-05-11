import { expect, test } from "./fixtures/auth";

test("dashboard webhook delivery row exposes replay and calls replay route", async ({
  authenticatedPage,
  e2eDb,
  e2eRunId,
  e2eUser,
}) => {
  const eventResult = await e2eDb.query<{ id: string }>(
    `insert into email_events (type, payload, user_id)
     values ('delivered', $1::jsonb, $2)
     returning id`,
    [JSON.stringify({ smtp_response: "250 ok" }), e2eUser.id],
  );
  const eventId = eventResult.rows[0]?.id;
  expect(eventId).toBeTruthy();

  const webhookResult = await e2eDb.query<{ id: string }>(
    `insert into webhooks (url, event_types, status, signing_secret, user_id, document)
     values ($1, $2::jsonb, 'active', 'whsec_e2e', $3, $4::jsonb)
     returning id`,
    [
      "https://example.com/e2e-webhook",
      JSON.stringify(["email.delivered"]),
      e2eUser.id,
      JSON.stringify({ test_run_id: e2eRunId }),
    ],
  );
  const webhookId = webhookResult.rows[0]?.id;
  expect(webhookId).toBeTruthy();

  const deliveryResult = await e2eDb.query<{ id: string }>(
    `insert into webhook_deliveries
       (webhook_id, event_id, attempt, status_code, response_body, status, attempted_at, next_retry_at)
     values ($1, $2, 1, 200, 'accepted', 'success', now(), null)
     returning id`,
    [webhookId, eventId],
  );
  const deliveryId = deliveryResult.rows[0]?.id;
  expect(deliveryId).toBeTruthy();

  let replayCalled = false;
  await authenticatedPage.route(
    `**/api/webhooks/${webhookId}/deliveries/${deliveryId}/replay`,
    async (route) => {
      replayCalled = true;
      await route.fulfill({
        status: 202,
        contentType: "application/json",
        body: JSON.stringify({
          object: "webhook_delivery_replay",
          replay_delivery: {
            id: "delivery-replay-e2e",
            status: "success",
          },
        }),
      });
    },
  );

  await authenticatedPage.goto(`/webhooks/${webhookId}`);

  await expect(
    authenticatedPage.getByRole("heading", {
      name: "https://example.com/e2e-webhook",
    }),
  ).toBeVisible();
  await expect(authenticatedPage.getByText(deliveryId)).toBeVisible();
  await expect(authenticatedPage.getByText("200")).toBeVisible();

  const replayButton = authenticatedPage.getByRole("button", {
    name: "Replay",
  });
  await expect(replayButton).toBeVisible();
  await replayButton.click();

  expect(replayCalled).toBe(true);
  await expect(authenticatedPage.getByRole("status")).toContainText(
    "Replay triggered as delivery-replay-e2e",
  );
});
