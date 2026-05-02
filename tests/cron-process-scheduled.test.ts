import { describe, expect, it, vi } from "vitest";

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
      new Request("http://localhost/api/internal/cron/process-scheduled"),
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
