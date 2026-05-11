import { expect, test } from "./fixtures/auth";

test("public status page renders without dashboard auth redirect", async ({
  page,
}) => {
  await page.goto("/status");

  await expect(page).toHaveURL(/\/status$/);
  await expect(
    page.getByRole("heading", { level: 1, name: /systems|disruption/i }),
  ).toBeVisible();
  await expect(page.getByTestId("status-component-app_api")).toBeVisible();
  await expect(page.getByTestId("status-component-dashboard")).toBeVisible();
  await expect(
    page.getByTestId("status-component-ingester_webhooks"),
  ).toBeVisible();
  await expect(
    page.getByTestId("status-component-database_queue"),
  ).toBeVisible();
  await expect(page.getByTestId("status-history-row").first()).toContainText(
    "No incidents",
  );
});

test("public status API returns component and history JSON without auth", async ({
  request,
}) => {
  const response = await request.get("/api/status");
  expect(response.status()).toBe(200);

  const body = await response.json();
  expect(
    body.components.map((component: { id: string }) => component.id),
  ).toEqual(["app_api", "dashboard", "ingester_webhooks", "database_queue"]);
  expect(body.history[0].title).toBe("No incidents");
});
