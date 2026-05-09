import { handleMcpHttpRequest } from "@opensend/mcp";
import { Hono } from "hono";
import { handlePostEmailBatchRequest } from "../../../src/lib/api/emails/batch-send";
import { handlePostEmailRequest } from "../../../src/lib/api/emails/send";

export const CONTROL_PLANE_API_SERVICE = "control-plane-api";
export const CONTROL_PLANE_API_VERSION = "0.1.0";

export type HealthResponse = {
  ok: true;
  service: typeof CONTROL_PLANE_API_SERVICE;
  version: typeof CONTROL_PLANE_API_VERSION;
};

export type ReadinessResponse = HealthResponse & {
  ready: true;
  checks: {
    config: "ok";
  };
};

export type ControlPlaneAppOptions = {
  mcpApiBaseUrl?: string;
  fetcher?: typeof fetch;
};

export function createApp(options: ControlPlaneAppOptions = {}) {
  const app = new Hono();

  app.get("/healthz", (c) =>
    c.json({
      ok: true,
      service: CONTROL_PLANE_API_SERVICE,
      version: CONTROL_PLANE_API_VERSION,
    } satisfies HealthResponse),
  );

  app.post("/emails", async (c) => await handlePostEmailRequest(c.req.raw));

  app.post(
    "/emails/batch",
    async (c) => await handlePostEmailBatchRequest(c.req.raw),
  );

  app.all(
    "/mcp",
    async (c) =>
      await handleMcpHttpRequest(c.req.raw, {
        apiBaseUrl:
          options.mcpApiBaseUrl ??
          process.env.OPENSEND_API_BASE_URL ??
          process.env.NEXT_PUBLIC_APP_URL,
        fetcher: options.fetcher,
      }),
  );

  app.get("/readyz", (c) =>
    c.json({
      ok: true,
      ready: true,
      service: CONTROL_PLANE_API_SERVICE,
      version: CONTROL_PLANE_API_VERSION,
      checks: {
        config: "ok",
      },
    } satisfies ReadinessResponse),
  );

  return app;
}

const app = createApp();

export default app;
