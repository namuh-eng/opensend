import { createTelemetryContext, emitCloudWatchMetric } from "@opensend/core";
import type { ScheduledJobName } from "@opensend/core";
import {
  OpenSendEnvValidationError,
  assertValidOpenSendEnv,
} from "@opensend/core/src/env";
import { fetchSchedulerJobResult } from "./job-scheduler-request";

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

const DEFAULT_INGESTER_URL = "http://ingester:3016";
const DEFAULT_INTERVAL_SECONDS = 60;
const REQUEST_TIMEOUT_MS = 20_000;

// Paths are kept as literal strings (not derived) so the static-coverage
// test at tests/ingester-job-scheduler-coverage.test.ts can grep for each
// endpoint in this source file. See that test for the contract.
const JOB_PATHS = {
  "scheduled-emails": "/jobs/scheduled-emails",
  webhooks: "/jobs/webhooks",
  "domain-verify": "/jobs/domain-verify",
  "billing-overage": "/jobs/billing-overage",
} as const satisfies Record<ScheduledJobName, string>;

type ScheduledJob = {
  readonly name: ScheduledJobName;
  readonly path: string;
};

type SchedulerHeartbeatRepo = {
  readonly upsert: (
    jobName: string,
    result: Record<string, unknown>,
  ) => Promise<unknown>;
};

type SchedulerRuntime = {
  readonly baseUrl: string;
  readonly heartbeatRepo: SchedulerHeartbeatRepo;
  readonly intervalMs: number;
  readonly jobs: readonly ScheduledJob[];
};

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

function emitSchedulerHeartbeat(): void {
  const telemetry = createTelemetryContext({
    service: "scheduler",
    operation: "scheduler.batch",
  });

  emitCloudWatchMetric(telemetry, {
    metrics: [{ name: "SchedulerHeartbeat", value: 1, unit: "Count" }],
    dimensions: {
      Service: "scheduler",
      Operation: "scheduler.batch",
    },
  });
}

function emitSchedulerJobFailed(
  job: ScheduledJob,
  fields: { status?: number; error?: string },
): void {
  const telemetry = createTelemetryContext({
    service: "scheduler",
    operation: "scheduler.job",
  });

  emitCloudWatchMetric(telemetry, {
    metrics: [{ name: "SchedulerJobFailed", value: 1, unit: "Count" }],
    dimensions: {
      Service: "scheduler",
      Operation: "scheduler.job",
    },
    fields: {
      job: job.name,
      ...fields,
    },
  });
}

async function runJob(
  runtime: SchedulerRuntime,
  job: ScheduledJob,
): Promise<void> {
  const url = new URL(job.path, runtime.baseUrl);
  const startedAt = Date.now();

  let status = 0;
  let ok = false;
  let body = "";

  try {
    const result = await fetchSchedulerJobResult({
      headers: buildHeaders(),
      timeoutMs: REQUEST_TIMEOUT_MS,
      url,
    });
    body = result.body;
    const durationMs = Date.now() - startedAt;
    status = result.status;
    ok = result.ok;

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

    if (!result.ok) {
      emitSchedulerJobFailed(job, { status: result.status });
    }
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      JSON.stringify({
        level: "error",
        event: "scheduler.job_failed",
        job: job.name,
        duration_ms: durationMs,
        error: message,
      }),
    );
    emitSchedulerJobFailed(job, { error: message });
  }

  // Upsert a heartbeat so /api/health/scheduler can detect stale jobs.
  // DB errors are caught here — a Postgres hiccup must not crash the scheduler.
  try {
    const resultPayload: Record<string, unknown> = {
      interval_ms: runtime.intervalMs,
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

    await runtime.heartbeatRepo.upsert(job.name, resultPayload);
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

async function runAllJobs(runtime: SchedulerRuntime): Promise<void> {
  for (const job of runtime.jobs) {
    await runJob(runtime, job);
  }
}

let isRunning = false;

async function runScheduledBatch(runtime: SchedulerRuntime): Promise<void> {
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
  emitSchedulerHeartbeat();
  try {
    await runAllJobs(runtime);
  } finally {
    isRunning = false;
  }
}

async function createSchedulerRuntime(): Promise<SchedulerRuntime> {
  runSchedulerStartupChecks();
  const { SCHEDULED_JOB_NAMES, schedulerHeartbeatRepo } = await import(
    "@opensend/core"
  );

  return {
    baseUrl: getEnv("INGESTER_URL") ?? DEFAULT_INGESTER_URL,
    heartbeatRepo: schedulerHeartbeatRepo,
    intervalMs: getIntervalMs(),
    jobs: SCHEDULED_JOB_NAMES.map((name) => ({
      name,
      path: JOB_PATHS[name],
    })),
  };
}

async function startScheduler(): Promise<void> {
  const runtime = await createSchedulerRuntime();

  console.log(
    JSON.stringify({
      level: "info",
      event: "scheduler.started",
      ingester_url: runtime.baseUrl,
      interval_seconds: runtime.intervalMs / 1000,
      jobs: runtime.jobs.map((job) => job.path),
      auth: getEnv("INGESTER_JOB_TOKEN") ? "bearer" : "none",
    }),
  );

  await runScheduledBatch(runtime);
  setInterval(() => {
    void runScheduledBatch(runtime);
  }, runtime.intervalMs);
}

const schedulerEntrypoint = process.argv[1];
const isSchedulerEntrypoint =
  schedulerEntrypoint?.endsWith("job-scheduler.ts") === true ||
  schedulerEntrypoint?.endsWith("job-scheduler.js") === true;

if (isSchedulerEntrypoint) {
  await startScheduler();
}
