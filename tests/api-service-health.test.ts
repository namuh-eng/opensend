import { describe, expect, it } from "vitest";
import app, {
  CONTROL_PLANE_API_SERVICE,
  CONTROL_PLANE_API_VERSION,
} from "../services/api/src/index";

describe("control-plane API health endpoints", () => {
  it("returns production-shaped health metadata", async () => {
    const response = await app.request("http://localhost/healthz");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      service: CONTROL_PLANE_API_SERVICE,
      version: CONTROL_PLANE_API_VERSION,
    });
  });

  it("returns readiness without requiring external credentials", async () => {
    const response = await app.request("http://localhost/readyz");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      ready: true,
      service: CONTROL_PLANE_API_SERVICE,
      version: CONTROL_PLANE_API_VERSION,
      checks: {
        config: "ok",
      },
    });
  });
});
