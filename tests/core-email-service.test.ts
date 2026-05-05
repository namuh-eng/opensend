import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFindByIdempotencyKey = vi.hoisted(() => vi.fn());
const mockCreateEmail = vi.hoisted(() => vi.fn());
const mockUpdateEmail = vi.hoisted(() => vi.fn());
const mockPublishBackgroundJob = vi.hoisted(() => vi.fn());
const mockProviderSendEmail = vi.hoisted(() => vi.fn());

vi.mock("../packages/core/src/db/repositories/emailRepo", () => ({
  emailRepo: {
    findByIdempotencyKey: mockFindByIdempotencyKey,
    create: mockCreateEmail,
    update: mockUpdateEmail,
  },
}));

vi.mock("../packages/core/src/jobs/background-jobs", () => ({
  createBackgroundJob: (job: Record<string, unknown>) => ({
    ...job,
    requestedAt: "2026-04-28T00:00:00.000Z",
  }),
  publishBackgroundJob: mockPublishBackgroundJob,
}));

vi.mock("../packages/core/src/services/emailProvider", () => ({
  emailProvider: {
    sendEmail: mockProviderSendEmail,
  },
}));

describe("EmailService", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockFindByIdempotencyKey.mockResolvedValue(null);
    mockCreateEmail.mockResolvedValue([{ id: "email-1" }]);
    mockPublishBackgroundJob.mockResolvedValue({
      status: "skipped",
      reason: "queue_url_missing",
    });
  });

  it("creates queued rows and publishes send jobs without calling SES", async () => {
    const { EmailService } = await import(
      "../packages/core/src/services/email"
    );
    const service = new EmailService();

    await expect(
      service.send({
        from: "sender@example.com",
        to: ["user@example.com"],
        subject: "Hello",
        html: "<p>Hello</p>",
      }),
    ).resolves.toEqual({ id: "email-1", providerId: null });

    expect(mockCreateEmail).toHaveBeenCalledWith(
      expect.objectContaining({ status: "queued" }),
    );
    expect(mockPublishBackgroundJob).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "email.send:email-1",
        type: "email.send",
        emailId: "email-1",
      }),
      expect.objectContaining({
        deduplicationId: "email.send:email-1",
        groupId: "email.send",
      }),
    );
    expect(mockProviderSendEmail).not.toHaveBeenCalled();
  });

  it("checks idempotency keys within the provided user scope", async () => {
    mockFindByIdempotencyKey.mockResolvedValue({ id: "email-1" });
    const { EmailService } = await import(
      "../packages/core/src/services/email"
    );
    const service = new EmailService();

    await expect(
      service.send({
        from: "sender@example.com",
        to: ["user@example.com"],
        subject: "Hello",
        idempotencyKey: "send-key-1",
        userId: "user-1",
      }),
    ).resolves.toEqual({ id: "email-1", duplicate: true });

    expect(mockFindByIdempotencyKey).toHaveBeenCalledWith(
      "send-key-1",
      "user-1",
    );
    expect(mockCreateEmail).not.toHaveBeenCalled();
    expect(mockPublishBackgroundJob).not.toHaveBeenCalled();
  });

  it("stores future scheduled emails without publishing an immediate send job", async () => {
    const { EmailService } = await import(
      "../packages/core/src/services/email"
    );
    const service = new EmailService();
    const scheduledAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await service.send({
      from: "sender@example.com",
      to: ["user@example.com"],
      subject: "Later",
      scheduledAt,
    });

    expect(mockCreateEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "scheduled",
        scheduledAt,
      }),
    );
    expect(mockPublishBackgroundJob).not.toHaveBeenCalled();
    expect(mockProviderSendEmail).not.toHaveBeenCalled();
  });
});
