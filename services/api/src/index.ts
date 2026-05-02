import { Hono } from "hono";

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

export function createApp() {
  const app = new Hono();

  app.get("/healthz", (c) =>
    c.json({
      ok: true,
      service: CONTROL_PLANE_API_SERVICE,
      version: CONTROL_PLANE_API_VERSION,
    } satisfies HealthResponse),
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
