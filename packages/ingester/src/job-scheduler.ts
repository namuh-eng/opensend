import {
  OpenSendEnvValidationError,
  assertValidOpenSendEnv,
} from "@opensend/core/src/env";

function runSchedulerStartupChecks(): void {
  try {
    assertValidOpenSendEnv(process.env, { service: "scheduler" });
  } catch (error) {
    if (error instanceof OpenSendEnvValidationError) {
      console.error(
        JSON.stringify({
          level: "error",
          event: "scheduler.startup.env_invalid",
          issues: error.issues.map((issue) => ({
            key: issue.key,
            message: issue.message,
          })),
        }),
      );
    }
    throw error;
  }
}

runSchedulerStartupChecks();

const { SCHEDULED_JOB_NAMES, schedulerHeartbeatRepo } = await import(
  "@opensend/core"
);

const DEFAULT_INGESTER_URL = "http://ingester:3016";
const DEFAULT_INTERVAL_SECONDS = 60;
const REQUEST_TIMEOUT_MS = 20_000;

// Paths are kept as literal strings (not derived) so the static-coverage
// test at tests/ingester-job-scheduler-coverage.test.ts can grep for each
// endpoint in this source file. See that test for the contract.
const JOB_PATHS: Record<(typeof SCHEDULED_JOB_NAMES)[number], string> = {
  "scheduled-emails": "/jobs/scheduled-emails",
  webhooks: "/jobs/webhooks",
  "domain-verify": "/jobs/domain-verify",
  "billing-overage": "/jobs/billing-overage",
};

type ScheduledJob = {
  name: (typeof SCHEDULED_JOB_NAMES)[number];
  path: string;
};

const scheduledJobs: ScheduledJob[] = SCHEDULED_JOB_NAMES.map((name) => ({
  name,
  path: JOB_PATHS[name],
}));

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

async function runJob(
  baseUrl: string,
  job: ScheduledJob,
  intervalMs: number,
): Promise<void> {
  const url = new URL(job.path, baseUrl);
  const startedAt = Date.now();

  let status = 0;
  let ok = false;
  let body = "";

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: buildHeaders(),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    body = await response.text();
    const durationMs = Date.now() - startedAt;
    status = response.status;
    ok = response.ok;

    console.log(
      JSON.stringify({
        level: ok ? "info" : "error",
        event: "scheduler.job_completed",
        job: job.name,
        status,
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

  // Upsert a heartbeat so /api/health/scheduler can detect stale jobs.
  // DB errors are caught here — a Postgres hiccup must not crash the scheduler.
  try {
    const resultPayload: Record<string, unknown> = {
      interval_ms: intervalMs,
      status: ok ? "ok" : "error",
      http_status: status,
    };

    // Parse the response body if it looks like JSON so that job-specific
    // counters (scanned, updated, etc.) are surfaced in the heartbeat row.
    try {
      const parsed: unknown = JSON.parse(body);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        Object.assign(resultPayload, parsed);
      }
    } catch {
      // body wasn't JSON — that's fine, we already logged it above
    }

    await schedulerHeartbeatRepo.upsert(job.name, resultPayload);
  } catch (heartbeatErr) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "scheduler.heartbeat_upsert_failed",
        job: job.name,
        error:
          heartbeatErr instanceof Error
            ? heartbeatErr.message
            : String(heartbeatErr),
      }),
    );
  }
}

async function runAllJobs(baseUrl: string, intervalMs: number): Promise<void> {
  for (const job of scheduledJobs) {
    await runJob(baseUrl, job, intervalMs);
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
    await runAllJobs(ingesterUrl, intervalMs);
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
