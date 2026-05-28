import {
  type EmailTraceRepository,
  EmailTraceServiceError,
  createEmailTraceService,
} from "@opensend/core";
import { describe, expect, it } from "vitest";

type TraceEmail = NonNullable<
  Awaited<ReturnType<EmailTraceRepository["findEmailForUser"]>>
>;
type TraceEvent = Awaited<
  ReturnType<EmailTraceRepository["listEventsByEmailIdAsc"]>
>[number];
type TraceLog = Awaited<
  ReturnType<EmailTraceRepository["listLogsForEmail"]>
>[number];
type TraceWebhook = Awaited<
  ReturnType<EmailTraceRepository["listWebhookDeliveriesForEmail"]>
>[number];
type TraceSuppression = NonNullable<
  Awaited<ReturnType<EmailTraceRepository["findSuppressionForEmail"]>>
>;

function makeEmail(overrides: Partial<TraceEmail> = {}): TraceEmail {
  return {
    id: "email-1",
    to: ["recipient@example.com"],
    subject: "Trace me",
    status: "queued",
    scheduledAt: null,
    sentAt: null,
    createdAt: new Date("2026-05-01T00:01:00.000Z"),
    providerRetryCount: 0,
    providerLastAttemptedAt: null,
    providerNextRetryAt: null,
    providerLastErrorCode: null,
    providerLastErrorMessage: null,
    providerDeadLetteredAt: null,
    tags: [{ name: "campaign", value: "launch" }],
    ...overrides,
  };
}

function makeEvent(overrides: Partial<TraceEvent> = {}): TraceEvent {
  return {
    id: "event-1",
    emailId: "email-1",
    sourceId: "ses-1",
    type: "delivered",
    payload: { smtpResponse: "250 ok" },
    userId: "user-1",
    receivedAt: new Date("2026-05-01T00:03:00.000Z"),
    ...overrides,
  };
}

function makeLog(overrides: Partial<TraceLog> = {}): TraceLog {
  return {
    id: "log-1",
    method: "POST",
    endpoint: "/api/emails",
    status: 202,
    apiKeyId: "11111111-1111-1111-1111-111111111111",
    createdAt: new Date("2026-05-01T00:00:00.000Z"),
    ...overrides,
  };
}

function makeWebhook(overrides: Partial<TraceWebhook> = {}): TraceWebhook {
  return {
    id: "delivery-1",
    webhookId: "22222222-2222-2222-2222-222222222222",
    webhookUrl: "https://example.com/webhook",
    eventId: "event-1",
    eventType: "delivered",
    attempt: 1,
    status: "success",
    statusCode: 200,
    attemptedAt: new Date("2026-05-01T00:04:00.000Z"),
    nextRetryAt: null,
    createdAt: new Date("2026-05-01T00:04:00.000Z"),
    ...overrides,
  };
}

function makeSuppression(
  overrides: Partial<TraceSuppression> = {},
): TraceSuppression {
  return {
    id: "suppression-1",
    email: "recipient@example.com",
    reason: "bounced",
    sourceEmailId: "email-1",
    sourceMessageId: "ses-1",
    metadata: { source: "ses" },
    suppressedAt: new Date("2026-05-01T00:05:00.000Z"),
    ...overrides,
  };
}

function makeRepository(
  overrides: Partial<EmailTraceRepository> = {},
): EmailTraceRepository {
  return {
    async findEmailForUser() {
      return makeEmail();
    },
    async listEventsByEmailIdAsc() {
      return [];
    },
    async listLogsForEmail() {
      return [];
    },
    async listWebhookDeliveriesForEmail() {
      return [];
    },
    async findSuppressionForEmail() {
      return undefined;
    },
    ...overrides,
  };
}

describe("email trace service", () => {
  it("combines request, queue, provider, webhook, and suppression events chronologically", async () => {
    const captured: Array<{ method: string; userId: string; emailId: string }> =
      [];
    const service = createEmailTraceService({
      repository: makeRepository({
        async findEmailForUser(emailId, userId) {
          captured.push({ method: "findEmailForUser", userId, emailId });
          return makeEmail({ id: emailId });
        },
        async listLogsForEmail(userId, emailId) {
          captured.push({ method: "listLogsForEmail", userId, emailId });
          return [makeLog()];
        },
        async listEventsByEmailIdAsc(emailId) {
          expect(emailId).toBe("email-1");
          return [makeEvent()];
        },
        async listWebhookDeliveriesForEmail(userId, emailId) {
          captured.push({
            method: "listWebhookDeliveriesForEmail",
            userId,
            emailId,
          });
          return [makeWebhook()];
        },
        async findSuppressionForEmail(userId, emailId, recipient) {
          expect(recipient).toBe("recipient@example.com");
          captured.push({ method: "findSuppressionForEmail", userId, emailId });
          return makeSuppression();
        },
      }),
    });

    const trace = await service.getTrace("user-1", "email-1");

    expect(captured).toEqual([
      { method: "findEmailForUser", userId: "user-1", emailId: "email-1" },
      { method: "listLogsForEmail", userId: "user-1", emailId: "email-1" },
      {
        method: "listWebhookDeliveriesForEmail",
        userId: "user-1",
        emailId: "email-1",
      },
      {
        method: "findSuppressionForEmail",
        userId: "user-1",
        emailId: "email-1",
      },
    ]);
    expect(trace.object).toBe("email_trace");
    expect(trace.email_id).toBe("email-1");
    expect(trace.data.map((item) => item.source)).toEqual([
      "request",
      "queue",
      "provider",
      "webhook",
      "suppression",
    ]);
    expect(trace.data[1]).toMatchObject({
      type: "created",
      details: { status: "queued", tags: ["campaign=launch"] },
    });
    expect(trace.data[2]).toMatchObject({
      source: "provider",
      type: "delivered",
      details: { smtp_response: "250 ok" },
    });
  });

  it("raises not found before loading child evidence", async () => {
    const service = createEmailTraceService({
      repository: makeRepository({
        async findEmailForUser() {
          return undefined;
        },
        async listLogsForEmail() {
          throw new Error("should not run");
        },
      }),
    });

    await expect(service.getTrace("user-1", "missing")).rejects.toEqual(
      new EmailTraceServiceError("email_not_found", "Email not found"),
    );
  });
});
