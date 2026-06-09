import {
  type EmailReadRepository,
  EmailReadServiceError,
  createEmailReadService,
} from "@opensend/core";
import { describe, expect, it } from "vitest";

type EmailRow = NonNullable<
  Awaited<ReturnType<EmailReadRepository["findByIdForUser"]>>
>;
type ListOptions = Parameters<EmailReadRepository["listForApi"]>[0];

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
    status: "delivered",
    providerRetryCount: 0,
    providerLastAttemptedAt: null,
    providerNextRetryAt: null,
    providerLastErrorCode: null,
    providerLastErrorMessage: null,
    providerDeadLetteredAt: null,
    tags: null,
    headers: null,
    attachments: null,
    scheduledAt: null,
    sentAt: new Date("2026-01-01T00:00:05Z"),
    createdAt: new Date("2026-01-01T00:00:00Z"),
    document: null,
    userId: "user-1",
    topicId: null,
    idempotencyKey: null,
    threadId: null,
    replyAddress: null,
    replyToken: null,
    ...overrides,
  };
}

function makeRepository(
  overrides: Partial<EmailReadRepository> = {},
): EmailReadRepository {
  return {
    async listForApi() {
      return { data: [], hasMore: false };
    },
    async findByIdForUser() {
      return makeEmail();
    },
    async deleteForUser() {},
    ...overrides,
  };
}

describe("email read service boundary", () => {
  it("normalizes list inputs, requires tenant scope, and maps retry visibility", async () => {
    let capturedOptions: ListOptions | undefined;
    const service = createEmailReadService({
      repository: makeRepository({
        async listForApi(options) {
          capturedOptions = options;
          return {
            hasMore: true,
            data: [
              makeEmail({
                providerRetryCount: 2,
                providerLastErrorCode: "Throttling",
                providerLastErrorMessage: null,
              }),
            ],
          };
        },
      }),
    });

    const result = await service.listEmails({
      userId: "user-1",
      limit: 500,
      after: "email-0",
      before: "ignored-before",
      status: " all ",
    });

    expect(capturedOptions).toEqual({
      userId: "user-1",
      limit: 100,
      after: "email-0",
      before: "ignored-before",
      status: undefined,
    });
    expect(result).toEqual({
      object: "list",
      has_more: true,
      data: [
        expect.objectContaining({
          id: "email-1",
          last_event: "delivered",
          reply_to: null,
          provider_retry_count: 2,
          provider_last_error: {
            code: "Throttling",
            message: "Provider send failed.",
          },
          sent_at: new Date("2026-01-01T00:00:05Z"),
        }),
      ],
    });
  });

  it("scopes detail reads and maps public detail fields", async () => {
    let capturedScope: { id: string; userId: string } | undefined;
    const service = createEmailReadService({
      repository: makeRepository({
        async findByIdForUser(id, userId) {
          capturedScope = { id, userId };
          return makeEmail({
            id,
            userId,
            tags: [{ name: "campaign", value: "launch" }],
          });
        },
      }),
    });

    const result = await service.getEmail("user-2", "email-2");

    expect(capturedScope).toEqual({ id: "email-2", userId: "user-2" });
    expect(result).toMatchObject({
      object: "email",
      id: "email-2",
      html: "<p>Hello</p>",
      text: null,
      tags: [{ name: "campaign", value: "launch" }],
      created_at: new Date("2026-01-01T00:00:00Z"),
    });
  });

  it("raises not_found for missing detail rows", async () => {
    const service = createEmailReadService({
      repository: makeRepository({
        async findByIdForUser() {
          return undefined;
        },
      }),
    });

    await expect(service.getEmail("user-1", "missing")).rejects.toBeInstanceOf(
      EmailReadServiceError,
    );
    await expect(service.getEmail("user-1", "missing")).rejects.toMatchObject({
      code: "not_found",
      message: "Email not found",
    });
  });

  it("scopes deletes while preserving collection delete success semantics", async () => {
    let capturedScope: { id: string; userId: string } | undefined;
    const service = createEmailReadService({
      repository: makeRepository({
        async deleteForUser(id, userId) {
          capturedScope = { id, userId };
        },
      }),
    });

    await expect(service.deleteEmail("user-3", "email-3")).resolves.toEqual({
      success: true,
    });
    expect(capturedScope).toEqual({ id: "email-3", userId: "user-3" });
  });
});
