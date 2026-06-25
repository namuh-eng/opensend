export type SchedulerFetch = (url: URL, init: RequestInit) => Promise<Response>;

export type SchedulerJobResult = {
  readonly body: string;
  readonly ok: boolean;
  readonly status: number;
};

export type FetchSchedulerJobOptions = {
  readonly headers: HeadersInit;
  readonly schedulerFetch?: SchedulerFetch;
  readonly timeoutMs: number;
  readonly url: URL;
};

export class SchedulerRequestTimeoutError extends Error {
  readonly timeoutMs: number;

  constructor(timeoutMs: number) {
    super(`scheduler job request timed out after ${timeoutMs}ms`);
    this.name = "SchedulerRequestTimeoutError";
    this.timeoutMs = timeoutMs;
  }
}

export async function fetchSchedulerJobResult({
  headers,
  schedulerFetch = fetch,
  timeoutMs,
  url,
}: FetchSchedulerJobOptions): Promise<SchedulerJobResult> {
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const request = schedulerFetch(url, {
    method: "POST",
    headers,
    signal: controller.signal,
  }).then(async (response) => ({
    body: await response.text(),
    ok: response.ok,
    status: response.status,
  }));
  request.catch(() => undefined);

  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      controller.abort();
      reject(new SchedulerRequestTimeoutError(timeoutMs));
    }, timeoutMs);
  });

  try {
    return await Promise.race([request, timeout]);
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  }
}
