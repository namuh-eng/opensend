// ABOUTME: Scheduler health endpoint — reports the liveness of each periodic
// ingester job by comparing the latest heartbeat timestamp against the job's
// declared interval.
//
// UNAUTHENTICATED by design: matches /api/health, which is also public.
// Heartbeat data carries no secrets (job names + timestamps only) and must
// be reachable by uptime monitors and load-balancer health probes without
// credentials.

import { SCHEDULED_JOB_NAMES, schedulerHeartbeatRepo } from "@opensend/core";

type JobState = "healthy" | "stale" | "missing";

type JobStatus = {
  name: string;
  state: JobState;
  last_seen_ms_ago: number | null;
  interval_ms: number | null;
};

function getJobState(
  lastSeenAt: Date | null,
  intervalMs: number | null,
): JobState {
  if (!lastSeenAt || !intervalMs) return "missing";

  const msAgo = Date.now() - lastSeenAt.getTime();

  // Allow 3× the declared interval as a jitter budget. This absorbs:
  //   - one missed run (scheduler restart, transient network hiccup)
  //   - clock skew between containers
  //   - the time it takes for a run to complete before writing its heartbeat
  // At the default 60 s interval this means a job is only flagged stale
  // after going silent for 3 minutes.
  if (msAgo > intervalMs * 3) return "stale";

  return "healthy";
}

export async function GET(): Promise<Response> {
  const rows = await schedulerHeartbeatRepo.listAll();

  const rowByName = new Map(rows.map((r) => [r.jobName, r]));

  const jobs: JobStatus[] = SCHEDULED_JOB_NAMES.map((name) => {
    const row = rowByName.get(name);
    if (!row) {
      return {
        name,
        state: "missing",
        last_seen_ms_ago: null,
        interval_ms: null,
      };
    }

    const lastResult = row.lastResult as Record<string, unknown> | null;
    const intervalMs =
      typeof lastResult?.interval_ms === "number"
        ? lastResult.interval_ms
        : null;
    const msAgo = Date.now() - row.lastSeenAt.getTime();
    const state = getJobState(row.lastSeenAt, intervalMs);

    return {
      name,
      state,
      last_seen_ms_ago: msAgo,
      interval_ms: intervalMs,
    };
  });

  const aggregateState: JobState = jobs.some((j) => j.state === "missing")
    ? "missing"
    : jobs.some((j) => j.state === "stale")
      ? "stale"
      : "healthy";

  const payload = {
    scheduler: aggregateState,
    jobs,
  };

  // Return 503 when any job is degraded so that load-balancer health probes
  // and uptime monitors can alert without custom logic.
  const status = aggregateState === "healthy" ? 200 : 503;

  return Response.json(payload, { status });
}
