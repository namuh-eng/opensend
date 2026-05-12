import type { Hono } from "hono";
import {
  handleDeleteSuppressionRequest,
  handleListSuppressionsRequest,
} from "../../../../src/lib/api/suppressions";

export function registerSuppressionRoutes(app: Hono) {
  app.get(
    "/suppressions",
    async (c) => await handleListSuppressionsRequest(c.req.raw),
  );

  app.delete(
    "/suppressions/:email",
    async (c) =>
      await handleDeleteSuppressionRequest(c.req.raw, c.req.param("email")),
  );
}
