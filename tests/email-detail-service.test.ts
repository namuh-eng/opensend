import {
  type EmailDetailRepository,
  EmailDetailServiceError,
  createEmailDetailService,
} from "@opensend/core";
import { afterEach, describe, expect, it, vi } from "vitest";

type EmailRow = NonNullable<
  Awaited<ReturnType<EmailDetailRepository["findEmailForUser"]>>
>;

function makeEmail(overrides: Partial<EmailRow> = {}): EmailRow {
  return {
    id: "email-1",
    from: "sender@example.com",
    to: ["user@example.com"],
    cc: null,
    bcc: null,
    replyTo: null,
    subject: "Hello",
    html: "<p>Hello</p>",
    text: null,
    status: "scheduled",
    providerRetryCount: 0,
    providerLastAttemptedAt: null,
    providerNextRetryAt: null,
    providerLastErrorCode: null,
    providerLastErrorMessage: null,
    providerDeadLetteredAt: null,
    tags: null,
    headers: null,
    attachments: null,
    scheduledAt: new Date("2026-05-08T00:00:00.000Z"),
    sentAt: null,
    createdAt: new Date("2026-05-07T00:00:00.000Z"),
    document: null,
    userId: "user-1",
    topicId: null,
    idempotencyKey: null,
    ...overrides,
  };
}

function makeRepository(
  overrides: Partial<EmailDetailRepository> = {},
): EmailDetailRepository {
  return {
    async findEmailForUser() {
      return makeEmail();
    },
    async updateScheduledAtForUser(id) {
      return { id };
    },
    ...overrides,
  };
}

describe("email detail service boundary", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("scopes detail reads and preserves the public DTO shape", async () => {
    let capturedScope: { id: string; userId: string } | undefined;
    const service = createEmailDetailService({
      repository: makeRepository({
        async findEmailForUser(id, userId) {
          capturedScope = { id, userId };
          return makeEmail({
            id,
            userId,
            status: "delivered",
            providerRetryCount: 2,
            providerLastAttemptedAt: new Date("2026-05-07T00:00:02.000Z"),
            providerNextRetryAt: new Date("2026-05-07T00:05:00.000Z"),
            providerLastErrorCode: "Throttling",
            providerLastErrorMessage: null,
            providerDeadLetteredAt: new Date("2026-05-07T00:10:00.000Z"),
            sentAt: new Date("2026-05-07T00:00:05.000Z"),
            tags: [{ name: "campaign", value: "launch" }],
          });
        },
      }),
    });

    const result = await service.getEmail({
      userId: "user-2",
      id: "email-2",
    });

    expect(capturedScope).toEqual({ id: "email-2", userId: "user-2" });
    expect(Object.keys(result)).toEqual([
      "object",
      "id",
      "from",
      "to",
      "subject",
      "html",
      "text",
      "cc",
      "bcc",
      "reply_to",
      "last_event",
      "provider_retry_count",
      "provider_last_attempted_at",
      "provider_next_retry_at",
      "provider_last_error",
      "provider_dead_lettered_at",
      "scheduled_at",
      "sent_at",
      "tags",
      "created_at",
    ]);
    expect(result).toEqual({
      object: "email",
      id: "email-2",
      from: "sender@example.com",
      to: ["user@example.com"],
      subject: "Hello",
      html: "<p>Hello</p>",
      text: null,
      cc: null,
      bcc: null,
      reply_to: null,
      last_event: "delivered",
      provider_retry_count: 2,
      provider_last_attempted_at: new Date("2026-05-07T00:00:02.000Z"),
      provider_next_retry_at: new Date("2026-05-07T00:05:00.000Z"),
      provider_last_error: {
        code: "Throttling",
        message: "Provider send failed.",
      },
      provider_dead_lettered_at: new Date("2026-05-07T00:10:00.000Z"),
      scheduled_at: new Date("2026-05-08T00:00:00.000Z"),
      sent_at: new Date("2026-05-07T00:00:05.000Z"),
      tags: [{ name: "campaign", value: "launch" }],
      created_at: new Date("2026-05-07T00:00:00.000Z"),
    });
  });

  it("raises not_found for missing or unowned detail reads", async () => {
    const service = createEmailDetailService({
      repository: makeRepository({
        async findEmailForUser() {
          return undefined;
        },
      }),
    });

    await expect(
      service.getEmail({ userId: "user-1", id: "missing" }),
    ).rejects.toEqual(
      new EmailDetailServiceError("not_found", "Email not found"),
    );
  });

  it("updates scheduled_at with tenant scope for ISO, natural language, and null values", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-07T00:00:00.000Z"));

    const updates: Array<{
      id: string;
      userId: string;
      scheduledAt: Date | null;
    }> = [];
    const service = createEmailDetailService({
      repository: makeRepository({
        async findEmailForUser(id, userId) {
          return makeEmail({ id, userId, status: "scheduled" });
        },
        async updateScheduledAtForUser(id, userId, scheduledAt) {
          updates.push({ id, userId, scheduledAt });
          return { id };
        },
      }),
    });

    await expect(
      service.updateEmail({
        userId: "user-1",
        id: "email-1",
        body: { scheduled_at: "2026-05-08T00:00:00.000Z" },
      }),
    ).resolves.toEqual({ object: "email", id: "email-1" });
    await service.updateEmail({
      userId: "user-1",
      id: "email-1",
      body: { scheduled_at: "in 1 day" },
    });
    await service.updateEmail({
      userId: "user-1",
      id: "email-1",
      body: { scheduled_at: null },
    });

    expect(updates).toEqual([
      {
        id: "email-1",
        userId: "user-1",
        scheduledAt: new Date("2026-05-08T00:00:00.000Z"),
      },
      {
        id: "email-1",
        userId: "user-1",
        scheduledAt: new Date("2026-05-08T00:00:00.000Z"),
      },
      { id: "email-1", userId: "user-1", scheduledAt: null },
    ]);
  });

  it("returns not_found before validating fields for missing or unowned update rows", async () => {
    const service = createEmailDetailService({
      repository: makeRepository({
        async findEmailForUser() {
          return undefined;
        },
        async updateScheduledAtForUser() {
          throw new Error("update should not run");
        },
      }),
    });

    await expect(
      service.updateEmail({
        userId: "user-1",
        id: "missing",
        body: { scheduled_at: "bad" },
      }),
    ).rejects.toEqual(
      new EmailDetailServiceError("not_found", "Email not found"),
    );
  });

  it("rejects non-scheduled emails with the existing status message", async () => {
    const service = createEmailDetailService({
      repository: makeRepository({
        async findEmailForUser() {
          return makeEmail({ status: "delivered" });
        },
      }),
    });

    await expect(
      service.updateEmail({
        userId: "user-1",
        id: "email-1",
        body: { scheduled_at: null },
      }),
    ).rejects.toEqual(
      new EmailDetailServiceError(
        "invalid_state",
        "Cannot update a delivered email",
      ),
    );
  });

  it("rejects invalid scheduled_at values and non-object bodies before writing", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-07T00:00:00.000Z"));

    const updateScheduledAtForUser = vi.fn();
    const service = createEmailDetailService({
      repository: makeRepository({ updateScheduledAtForUser }),
    });

    for (const body of [
      null,
      [],
      { scheduled_at: "later today" },
      { scheduled_at: "2026-05-06T23:59:00.000Z" },
      { scheduled_at: "in 31 days" },
      { scheduled_at: 123 },
    ]) {
      await expect(
        service.updateEmail({ userId: "user-1", id: "email-1", body }),
      ).rejects.toMatchObject({
        name: "EmailDetailServiceError",
        code: "invalid_scheduled_at",
      });
    }

    expect(updateScheduledAtForUser).not.toHaveBeenCalled();
  });

  it("rejects requests with no accepted update fields", async () => {
    const service = createEmailDetailService({ repository: makeRepository() });

    await expect(
      service.updateEmail({
        userId: "user-1",
        id: "email-1",
        body: { subject: "Ignored" },
      }),
    ).rejects.toEqual(
      new EmailDetailServiceError("no_fields", "No fields to update"),
    );
  });

  it("surfaces unexpected empty update results as 500-compatible errors", async () => {
    const service = createEmailDetailService({
      repository: makeRepository({
        async updateScheduledAtForUser() {
          return undefined;
        },
      }),
    });

    await expect(
      service.updateEmail({
        userId: "user-1",
        id: "email-1",
        body: { scheduled_at: null },
      }),
    ).rejects.toThrow("Email update returned no row");
  });
});
