import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockProcessScheduledAutomations = vi.hoisted(() => vi.fn());
const mockProcessScheduledBroadcasts = vi.hoisted(() => vi.fn());
const mockProcessScheduledEmails = vi.hoisted(() => vi.fn());

vi.mock("@/lib/workers/automation-runner", () => ({
  processScheduledAutomations: mockProcessScheduledAutomations,
}));
vi.mock("@/lib/workers/broadcast-sender", () => ({
  processScheduledBroadcasts: mockProcessScheduledBroadcasts,
}));
vi.mock("@/lib/workers/scheduled-emails", () => ({
  processScheduledEmails: mockProcessScheduledEmails,
}));

describe("process-scheduled cron route", () => {
  const originalCronAuthToken = process.env.CRON_AUTH_TOKEN;

  beforeEach(() => {
    process.env.CRON_AUTH_TOKEN = "cron-secret";
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (originalCronAuthToken === undefined) {
      Reflect.deleteProperty(process.env, "CRON_AUTH_TOKEN");
    } else {
      process.env.CRON_AUTH_TOKEN = originalCronAuthToken;
    }
  });

  it("returns 401 and does not process jobs when CRON_AUTH_TOKEN is unset", async () => {
    Reflect.deleteProperty(process.env, "CRON_AUTH_TOKEN");

    const { GET } = await import(
      "@/app/api/internal/cron/process-scheduled/route"
    );
    const response = await GET(
      new Request("http://localhost/api/internal/cron/process-scheduled", {
        headers: { "x-cron-auth": "cron-secret" },
      }),
    );

    expect(response.status).toBe(401);
    expect(mockProcessScheduledEmails).not.toHaveBeenCalled();
    expect(mockProcessScheduledBroadcasts).not.toHaveBeenCalled();
    expect(mockProcessScheduledAutomations).not.toHaveBeenCalled();
  });

  it("returns 401 and does not process jobs when the cron token mismatches", async () => {
    const { GET } = await import(
      "@/app/api/internal/cron/process-scheduled/route"
    );
    const response = await GET(
      new Request("http://localhost/api/internal/cron/process-scheduled", {
        headers: { "x-cron-auth": "wrong" },
      }),
    );

    expect(response.status).toBe(401);
    expect(mockProcessScheduledEmails).not.toHaveBeenCalled();
    expect(mockProcessScheduledBroadcasts).not.toHaveBeenCalled();
    expect(mockProcessScheduledAutomations).not.toHaveBeenCalled();
  });

  it("includes automation runner summary next to emails and broadcasts", async () => {
    vi.resetModules();
    mockProcessScheduledEmails.mockResolvedValue({ processed: 1, enqueued: 1 });
    mockProcessScheduledBroadcasts.mockResolvedValue({ processed: 2 });
    mockProcessScheduledAutomations.mockResolvedValue({
      processed: 3,
      advanced: 2,
      failed: 1,
      skipped: 0,
    });

    const { GET } = await import(
      "@/app/api/internal/cron/process-scheduled/route"
    );
    const response = await GET(
      new Request("http://localhost/api/internal/cron/process-scheduled", {
        headers: { "x-cron-auth": "cron-secret" },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      emails: { processed: 1, enqueued: 1 },
      broadcasts: { processed: 2 },
      automations: { processed: 3, advanced: 2, failed: 1, skipped: 0 },
    });
  });
});
