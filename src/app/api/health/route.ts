// ABOUTME: Healthcheck endpoint — confirms the app is running and the database is reachable.

import { db } from "@/lib/db";
import { createHealthService } from "@opensend/core";

const healthService = createHealthService({
  database: {
    execute(query) {
      return db.execute(query);
    },
  },
});

export async function GET() {
  const health = await healthService.check();

  if (health.status === "error") {
    return Response.json(health, { status: 503 });
  }

  return Response.json(health);
}
