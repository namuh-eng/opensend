// E2E category: mocked browser integration; API responses are route-mocked to exercise automation dashboard client state only.
import { type BrowserContext, type Page, expect, test } from "@playwright/test";

const automation = {
  object: "automation",
  id: "auto_1",
  name: "Welcome automation",
  status: "enabled",
  trigger_event_name: "user.signed_up",
  step_count: 4,
  last_run: { status: "failed", created_at: "2026-05-02T10:00:00.000Z" },
  connections: [
    { from: "trigger", to: "delay" },
    { from: "delay", to: "send_email" },
    { from: "send_email", to: "end" },
  ],
  steps: [
    {
      id: "step_1",
      key: "trigger",
      type: "trigger",
      config: { event_name: "user.signed_up" },
      position: 0,
    },
    {
      id: "step_2",
      key: "delay",
      type: "delay",
      config: { duration: "1 hour" },
      position: 1,
    },
    {
      id: "step_3",
      key: "send_email",
      type: "send_email",
      config: { template: { id: "tmpl_1" }, subject: "Hi" },
      position: 2,
    },
    { id: "step_4", key: "end", type: "end", config: {}, position: 3 },
  ],
  created_at: "2026-05-02T09:00:00.000Z",
  updated_at: "2026-05-02T09:30:00.000Z",
};

async function signIn(context: BrowserContext) {
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
}

async function mockAutomationApis(page: Page) {
  await page.route("**/api/auth/get-session", async (route) => {
    await route.fulfill({
      json: {
        session: { id: "e2e-session", token: "e2e-session-token" },
        user: { id: "e2e-user", email: "e2e@example.com", name: "E2E User" },
      },
    });
  });
  await page.route("**/api/templates?status=published", async (route) => {
    await route.fulfill({
      json: {
        object: "list",
        data: [
          { id: "tmpl_1", name: "Published welcome", status: "published" },
        ],
      },
    });
  });
  await page.route(/.*\/api\/automations(?:\?.*)?$/, async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({
        json: { ...automation, id: "auto_created", name: "Created automation" },
      });
      return;
    }
    await route.fulfill({
      json: { object: "list", data: [automation], has_more: false },
    });
  });
  await page.route("**/api/automations/auto_1", async (route) => {
    await route.fulfill({ json: automation });
  });
  await page.route("**/api/automations/auto_1/runs?**", async (route) => {
    await route.fulfill({
      json: {
        object: "list",
        data: [
          {
            id: "run_1",
            automation_id: "auto_1",
            status: "failed",
            current_step_key: null,
            failed_step_key: "send_email",
            failure_reason: "Template render failed",
            started_at: "2026-05-02T10:00:00.000Z",
            completed_at: "2026-05-02T10:00:05.000Z",
            next_step_at: null,
            duration_ms: 5000,
            created_at: "2026-05-02T10:00:00.000Z",
          },
        ],
        has_more: false,
      },
    });
  });
}

test("automations dashboard lists automations and shows run failure fields", async ({
  context,
  page,
}) => {
  await signIn(context);
  await mockAutomationApis(page);

  await page.goto("/automations");
  await expect(
    page.getByRole("heading", { name: "Automations" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Welcome automation" }),
  ).toBeVisible();
  await expect(page.getByText("user.signed_up")).toBeVisible();
  await expect(page.getByText("Failed ·")).toBeVisible();

  await page.getByRole("link", { name: "Welcome automation" }).click();
  await page.getByRole("tab", { name: "Runs" }).click();
  await expect(page.getByRole("link", { name: "Failed" })).toBeVisible();
  await expect(page.getByText("send_email")).toBeVisible();
  await expect(page.getByText("Template render failed")).toBeVisible();
});

test("automation create form submits the MVP linear flow", async ({
  context,
  page,
}) => {
  await signIn(context);
  await mockAutomationApis(page);

  await page.goto("/automations/new");
  await page
    .getByRole("textbox", { name: "Name", exact: true })
    .fill("Created automation");
  await page.getByLabel("Event name").fill("user.created");
  await page.getByLabel("Add a delay").check();
  await page.getByLabel("Duration").fill("1 hour");
  await page.getByLabel("Published template").selectOption("tmpl_1");
  await page.getByLabel("Subject override").fill("Welcome");
  await page.getByRole("button", { name: "Create automation" }).click();

  await expect(page).toHaveURL(/\/automations\/auto_created/);
});
