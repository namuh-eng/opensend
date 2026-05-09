const DEFAULT_INGESTER_URL = "http://ingester:3016";
const DEFAULT_INTERVAL_SECONDS = 60;
const REQUEST_TIMEOUT_MS = 20_000;

type ScheduledJob = {
  name: string;
  path: string;
};

const scheduledJobs = [
  { name: "scheduled-emails", path: "/jobs/scheduled-emails" },
  { name: "webhooks", path: "/jobs/webhooks" },
  { name: "domain-verify", path: "/jobs/domain-verify" },
] satisfies ScheduledJob[];

function getEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value && value.length > 0 ? value : undefined;
}

function getIntervalMs(): number {
  const raw = getEnv("INGESTER_SCHEDULER_INTERVAL_SECONDS");
  if (!raw) return DEFAULT_INTERVAL_SECONDS * 1000;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 10) {
    console.warn(
      JSON.stringify({
        level: "warn",
        event: "scheduler.invalid_interval",
        raw,
        default_seconds: DEFAULT_INTERVAL_SECONDS,
      }),
    );
    return DEFAULT_INTERVAL_SECONDS * 1000;
  }
  return Math.floor(parsed * 1000);
}

function buildHeaders(): HeadersInit {
  const token = getEnv("INGESTER_JOB_TOKEN");
  return token ? { authorization: `Bearer ${token}` } : {};
}

async function runJob(baseUrl: string, job: ScheduledJob): Promise<void> {
  const url = new URL(job.path, baseUrl);
  const startedAt = Date.now();

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: buildHeaders(),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const body = await response.text();
    const durationMs = Date.now() - startedAt;

    console.log(
      JSON.stringify({
        level: response.ok ? "info" : "error",
        event: "scheduler.job_completed",
        job: job.name,
        status: response.status,
        duration_ms: durationMs,
        body: body.slice(0, 500),
      }),
    );
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    console.error(
      JSON.stringify({
        level: "error",
        event: "scheduler.job_failed",
        job: job.name,
        duration_ms: durationMs,
        error: error instanceof Error ? error.message : String(error),
      }),
    );
  }
}

async function runAllJobs(baseUrl: string): Promise<void> {
  for (const job of scheduledJobs) {
    await runJob(baseUrl, job);
  }
}

const ingesterUrl = getEnv("INGESTER_URL") ?? DEFAULT_INGESTER_URL;
const intervalMs = getIntervalMs();
let isRunning = false;

async function runScheduledBatch(): Promise<void> {
  if (isRunning) {
    console.warn(
      JSON.stringify({
        level: "warn",
        event: "scheduler.batch_skipped",
        reason: "previous_batch_still_running",
      }),
    );
    return;
  }

  isRunning = true;
  try {
    await runAllJobs(ingesterUrl);
  } finally {
    isRunning = false;
  }
}

console.log(
  JSON.stringify({
    level: "info",
    event: "scheduler.started",
    ingester_url: ingesterUrl,
    interval_seconds: intervalMs / 1000,
    jobs: scheduledJobs.map((job) => job.path),
    auth: getEnv("INGESTER_JOB_TOKEN") ? "bearer" : "none",
  }),
);

await runScheduledBatch();
setInterval(() => {
  void runScheduledBatch();
}, intervalMs);

export {};
