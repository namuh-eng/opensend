import { db } from "@/lib/db";
import { createHealthService, createPublicStatusService } from "@opensend/core";

const STATUS_PROBE_TIMEOUT_MS = 2_000;
const healthService = createHealthService({
  database: {
    execute(query) {
      return db.execute(query);
    },
  },
});

function getOptionalUrl(name: string): string | null {
  const value = process.env[name]?.trim();
  return value && value.length > 0 ? value : null;
}

function isQueueConfigured(): boolean {
  return Boolean(getOptionalUrl("BACKGROUND_JOBS_QUEUE_URL"));
}

function createIngesterProbe() {
  const url = getOptionalUrl("INGESTER_HEALTH_URL");
  if (!url) return undefined;

  return async () => {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      STATUS_PROBE_TIMEOUT_MS,
    );

    try {
      const response = await fetch(url, {
        cache: "no-store",
        signal: controller.signal,
      });
      return { ok: response.ok };
    } catch {
      return { ok: false };
    } finally {
      clearTimeout(timeout);
    }
  };
}

export async function getPublicStatusSnapshot() {
  const service = createPublicStatusService({
    health: healthService,
    ingesterProbe: createIngesterProbe(),
    queueConfigured: isQueueConfigured,
  });

  return await service.snapshot();
}
