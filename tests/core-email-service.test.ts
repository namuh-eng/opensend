import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockFindByIdempotencyKey = vi.hoisted(() => vi.fn());
const mockExpireIdempotencyKeyBefore = vi.hoisted(() => vi.fn());
const mockCreateEmail = vi.hoisted(() => vi.fn());
const mockFindSuppressedRecipients = vi.hoisted(() => vi.fn());
const mockUpdateEmail = vi.hoisted(() => vi.fn());
const mockCreateEmailEvent = vi.hoisted(() => vi.fn());
const mockEnqueueEmailWebhookEvent = vi.hoisted(() => vi.fn());
const mockPublishBackgroundJob = vi.hoisted(() => vi.fn());
const mockProviderSendEmail = vi.hoisted(() => vi.fn());

vi.mock("../packages/core/src/db/repositories/emailEventRepo", () => ({
  emailEventRepo: {
    create: mockCreateEmailEvent,
  },
}));

vi.mock("../packages/core/src/services/email-webhook-events", () => ({
  enqueueEmailWebhookEvent: mockEnqueueEmailWebhookEvent,
}));

vi.mock("../packages/core/src/db/repositories/emailRepo", () => ({
  emailRepo: {
    findByIdempotencyKey: mockFindByIdempotencyKey,
    expireIdempotencyKeyBefore: mockExpireIdempotencyKeyBefore,
    create: mockCreateEmail,
    update: mockUpdateEmail,
  },
}));

vi.mock("../packages/core/src/db/repositories/suppressionRepo", () => ({
  suppressionRepo: {
    findByUserAndEmails: mockFindSuppressedRecipients,
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
    mockFindSuppressedRecipients.mockResolvedValue([]);
    mockExpireIdempotencyKeyBefore.mockResolvedValue(undefined);
    mockCreateEmail.mockResolvedValue([{ id: "email-1" }]);
    mockPublishBackgroundJob.mockResolvedValue({
      status: "skipped",
      reason: "queue_url_missing",
    });
    mockEnqueueEmailWebhookEvent.mockResolvedValue({
      eventId: "event-1",
      deliveryIds: [],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
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
      { createdAtOrAfter: expect.any(Date) },
    );
    expect(mockExpireIdempotencyKeyBefore).not.toHaveBeenCalled();
    expect(mockCreateEmail).not.toHaveBeenCalled();
    expect(mockPublishBackgroundJob).not.toHaveBeenCalled();
  });

  it("expires stale idempotency keys before accepting a new service send", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-12T12:00:00.000Z"));

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
    ).resolves.toEqual({ id: "email-1", providerId: null });

    expect(mockFindByIdempotencyKey).toHaveBeenCalledWith(
      "send-key-1",
      "user-1",
      { createdAtOrAfter: new Date("2026-05-11T12:00:00.000Z") },
    );
    expect(mockExpireIdempotencyKeyBefore).toHaveBeenCalledWith(
      "send-key-1",
      new Date("2026-05-11T12:00:00.000Z"),
      "user-1",
    );
    expect(mockCreateEmail).toHaveBeenCalledWith(
      expect.objectContaining({ idempotencyKey: "send-key-1" }),
    );

    vi.useRealTimers();
  });

  it("audits queue publish failures on the persisted email row and timeline", async () => {
    mockCreateEmail.mockResolvedValue([{ id: "email-failed" }]);
    mockPublishBackgroundJob.mockRejectedValue(
      Object.assign(new Error("SQS unavailable"), { name: "QueueUnavailable" }),
    );

    const { EmailService } = await import(
      "../packages/core/src/services/email"
    );
    const service = new EmailService();

    await expect(
      service.send({
        from: "sender@example.com",
        to: ["user@example.com"],
        subject: "Hello",
        userId: "user-1",
      }),
    ).rejects.toThrow("SQS unavailable");

    expect(mockUpdateEmail).toHaveBeenCalledWith(
      "email-failed",
      {
        status: "failed",
        providerLastAttemptedAt: expect.any(Date),
        providerLastErrorCode: "QueueUnavailable",
        providerLastErrorMessage: "SQS unavailable",
        providerNextRetryAt: null,
        providerDeadLetteredAt: expect.any(Date),
      },
      "user-1",
    );
    expect(mockCreateEmailEvent).toHaveBeenCalledWith({
      emailId: "email-failed",
      userId: "user-1",
      sourceId: "queue-publish-failed:email-failed",
      type: "failed",
      payload: {
        reason: "queue_publish_failed",
        error: { code: "QueueUnavailable", message: "SQS unavailable" },
      },
      receivedAt: expect.any(Date),
    });
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
    expect(mockEnqueueEmailWebhookEvent).not.toHaveBeenCalled();
  });

  it("emits a suppressed webhook event before returning recipient_suppressed", async () => {
    mockFindSuppressedRecipients.mockResolvedValue([
      { email: "blocked@example.com", reason: "bounced" },
    ]);
    const { EmailService, SuppressedRecipientError } = await import(
      "../packages/core/src/services/email"
    );
    const service = new EmailService();

    await expect(
      service.send({
        from: "sender@example.com",
        to: ["blocked@example.com"],
        subject: "Blocked",
        userId: "user-1",
      }),
    ).rejects.toBeInstanceOf(SuppressedRecipientError);

    expect(mockCreateEmail).not.toHaveBeenCalled();
    expect(mockPublishBackgroundJob).not.toHaveBeenCalled();
    expect(mockEnqueueEmailWebhookEvent).toHaveBeenCalledWith({
      type: "email.suppressed",
      userId: "user-1",
      payload: {
        reason: "recipient_suppressed",
        recipients: [{ email: "blocked@example.com", reason: "bounced" }],
        recipient_count: 1,
        submitted_at: expect.any(String),
      },
      receivedAt: expect.any(Date),
    });
  });

  it("emits a scheduled webhook event when accepting future delivery", async () => {
    mockCreateEmail.mockResolvedValue([{ id: "email-scheduled" }]);
    const { EmailService } = await import(
      "../packages/core/src/services/email"
    );
    const service = new EmailService();
    const scheduledAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await service.send({
      from: "sender@example.com",
      to: ["user@example.com", "second@example.com"],
      subject: "Later",
      scheduledAt,
      userId: "user-1",
    });

    expect(mockEnqueueEmailWebhookEvent).toHaveBeenCalledWith({
      type: "email.scheduled",
      userId: "user-1",
      emailId: "email-scheduled",
      sourceId: "scheduled:email-scheduled",
      payload: {
        email_id: "email-scheduled",
        status: "scheduled",
        scheduled_at: scheduledAt.toISOString(),
        accepted_at: expect.any(String),
        recipient_count: 2,
      },
      receivedAt: expect.any(Date),
    });
    expect(mockPublishBackgroundJob).not.toHaveBeenCalled();
  });
});
