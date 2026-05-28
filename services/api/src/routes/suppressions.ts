import type { Hono } from "hono";
import {
  handleCreateSuppressionRequest,
  handleDeleteSuppressionRequest,
  handleExportSuppressionsRequest,
  handleImportSuppressionsRequest,
  handleListSuppressionsRequest,
} from "../../../../src/lib/api/suppressions";

export function registerSuppressionRoutes(app: Hono) {
  app.get(
    "/suppressions",
    async (c) => await handleListSuppressionsRequest(c.req.raw),
  );

  app.post(
    "/suppressions",
    async (c) => await handleCreateSuppressionRequest(c.req.raw),
  );

  app.post(
    "/suppressions/import",
    async (c) => await handleImportSuppressionsRequest(c.req.raw),
  );

  app.get(
    "/suppressions/export",
    async (c) => await handleExportSuppressionsRequest(c.req.raw),
  );

  app.delete(
    "/suppressions/:email",
    async (c) =>
      await handleDeleteSuppressionRequest(c.req.raw, c.req.param("email")),
  );
}
