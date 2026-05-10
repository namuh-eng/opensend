import type { Hono } from "hono";
import {
  handleCreateWebhookRequest,
  handleDeleteWebhookRequest,
  handleGetWebhookRequest,
  handleListWebhooksRequest,
  handleUpdateWebhookRequest,
} from "../../../../src/lib/api/webhooks";

export function registerWebhookRoutes(app: Hono) {
  app.get("/webhooks", async (c) => await handleListWebhooksRequest(c.req.raw));

  app.post(
    "/webhooks",
    async (c) => await handleCreateWebhookRequest(c.req.raw),
  );

  app.get(
    "/webhooks/:id",
    async (c) => await handleGetWebhookRequest(c.req.raw, c.req.param("id")),
  );

  app.patch(
    "/webhooks/:id",
    async (c) => await handleUpdateWebhookRequest(c.req.raw, c.req.param("id")),
  );

  app.delete(
    "/webhooks/:id",
    async (c) => await handleDeleteWebhookRequest(c.req.raw, c.req.param("id")),
  );
}
