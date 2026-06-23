import { describe, expect, it } from "vitest";
import {
  type SchedulerRequestTimeoutError,
  fetchSchedulerJobResult,
} from "../packages/ingester/src/job-scheduler-request";

describe("ingester job scheduler request timeout", () => {
  it("fails a never-settling job request on the scheduler timeout", async () => {
    const neverSettles = () => new Promise<Response>(() => undefined);

    await expect(
      fetchSchedulerJobResult({
        headers: {},
        schedulerFetch: neverSettles,
        timeoutMs: 1,
        url: new URL("https://events.opensend.test/jobs/webhooks"),
      }),
    ).rejects.toMatchObject({
      name: "SchedulerRequestTimeoutError",
      timeoutMs: 1,
    } satisfies Partial<SchedulerRequestTimeoutError>);
  });

  it("returns the response body when the job completes before the timeout", async () => {
    const completes = () =>
      Promise.resolve(
        new Response('{"processed":0,"results":[]}', { status: 200 }),
      );

    await expect(
      fetchSchedulerJobResult({
        headers: { authorization: "Bearer test" },
        schedulerFetch: completes,
        timeoutMs: 1_000,
        url: new URL("https://events.opensend.test/jobs/webhooks"),
      }),
    ).resolves.toEqual({
      body: '{"processed":0,"results":[]}',
      ok: true,
      status: 200,
    });
  });
});
