export type SchedulerHeartbeatRepo = {
  readonly upsert: (
    jobName: string,
    result: Record<string, unknown>,
  ) => Promise<unknown>;
};

export type UpsertSchedulerHeartbeatOptions = {
  readonly heartbeatRepo: SchedulerHeartbeatRepo;
  readonly jobName: string;
  readonly result: Record<string, unknown>;
  readonly timeoutMs: number;
};

export class SchedulerHeartbeatTimeoutError extends Error {
  readonly jobName: string;
  readonly timeoutMs: number;

  constructor(jobName: string, timeoutMs: number) {
    super(
      `scheduler heartbeat upsert for ${jobName} timed out after ${timeoutMs}ms`,
    );
    this.name = "SchedulerHeartbeatTimeoutError";
    this.jobName = jobName;
    this.timeoutMs = timeoutMs;
  }
}

export async function upsertSchedulerHeartbeat({
  heartbeatRepo,
  jobName,
  result,
  timeoutMs,
}: UpsertSchedulerHeartbeatOptions): Promise<unknown> {
  const upsert = heartbeatRepo.upsert(jobName, result);
  upsert.catch(() => undefined);

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new SchedulerHeartbeatTimeoutError(jobName, timeoutMs));
    }, timeoutMs);
  });

  try {
    return await Promise.race([upsert, timeout]);
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  }
}
