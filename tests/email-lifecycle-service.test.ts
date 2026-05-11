import {
  type EmailLifecycleAttachmentRow,
  type EmailLifecycleRepository,
  EmailLifecycleServiceError,
  createEmailLifecycleService,
} from "@opensend/core";
import { describe, expect, it } from "vitest";

type LifecycleEmail = NonNullable<
  Awaited<ReturnType<EmailLifecycleRepository["findEmailForUser"]>>
>;
type LifecycleEvent = Awaited<
  ReturnType<EmailLifecycleRepository["listEventsByEmailIdAsc"]>
>[number];

function makeEmail(overrides: Partial<LifecycleEmail> = {}): LifecycleEmail {
  return {
    id: "email-1",
    status: "scheduled",
    attachments: null,
    ...overrides,
  };
}

function makeAttachments(
  attachments: EmailLifecycleAttachmentRow[],
): LifecycleEmail["attachments"] {
  return attachments as LifecycleEmail["attachments"];
}

function makeEvent(overrides: Partial<LifecycleEvent> = {}): LifecycleEvent {
  return {
    id: "event-1",
    emailId: "email-1",
    sourceId: null,
    type: "delivered",
    payload: { delivery: true },
    userId: "user-1",
    receivedAt: new Date("2026-05-01T00:00:00.000Z"),
    ...overrides,
  };
}

function makeRepository(
  overrides: Partial<EmailLifecycleRepository> = {},
): EmailLifecycleRepository {
  return {
    async findEmailForUser() {
      return makeEmail();
    },
    async updateEmailStatusForUser(id, _userId, status) {
      return { id, status };
    },
    async listEventsByEmailIdAsc() {
      return [];
    },
    ...overrides,
  };
}

describe("email lifecycle service boundary", () => {
  it("lists attachments with scoped parent lookup and legacy fallbacks", async () => {
    let capturedScope: { id: string; userId: string } | undefined;
    const service = createEmailLifecycleService({
      repository: makeRepository({
        async findEmailForUser(id, userId) {
          capturedScope = { id, userId };
          return makeEmail({
            id,
            attachments: makeAttachments([
              { filename: "receipt.txt" },
              {
                id: "att-custom",
                filename: "logo.png",
                content_type: "image/png",
              },
            ]),
          });
        },
      }),
    });

    await expect(service.listAttachments("user-1", "email-1")).resolves.toEqual(
      {
        object: "list",
        data: [
          {
            id: "att-0",
            filename: "receipt.txt",
            content_type: "application/octet-stream",
          },
          {
            id: "att-custom",
            filename: "logo.png",
            content_type: "image/png",
          },
        ],
      },
    );
    expect(capturedScope).toEqual({ id: "email-1", userId: "user-1" });
  });

  it("resolves attachment detail ids, S3 keys, URLs, and one-hour expiry", async () => {
    const presignedKeys: string[] = [];
    const service = createEmailLifecycleService({
      repository: makeRepository({
        async findEmailForUser(id) {
          return makeEmail({
            id,
            attachments: makeAttachments([
              {
                filename: "stored.pdf",
                contentType: "application/pdf",
                s3Key: "stored/key.pdf",
              },
              {
                filename: "path.txt",
                contentType: "text/plain",
                path: "path/key.txt",
              },
              {
                id: "named",
                filename: "fallback.bin",
              },
            ]),
          });
        },
      }),
      async getPresignedUrl(key) {
        presignedKeys.push(key);
        return `https://download.test/${key}`;
      },
      now: () => new Date("2026-05-01T12:00:00.000Z"),
    });

    await expect(
      service.getAttachment("user-1", "email-1", "att-0"),
    ).resolves.toMatchObject({
      object: "attachment",
      id: "att-0",
      filename: "stored.pdf",
      content_type: "application/pdf",
      download_url: "https://download.test/stored/key.pdf",
      expires_at: "2026-05-01T13:00:00.000Z",
    });
    await expect(
      service.getAttachment("user-1", "email-1", "att-1"),
    ).resolves.toMatchObject({
      id: "att-1",
      download_url: "https://download.test/path/key.txt",
    });
    await expect(
      service.getAttachment("user-1", "email-1", "named"),
    ).resolves.toMatchObject({
      id: "named",
      content_type: "application/octet-stream",
      download_url: "https://download.test/sent-emails/email-1/fallback.bin",
    });
    expect(presignedKeys).toEqual([
      "stored/key.pdf",
      "path/key.txt",
      "sent-emails/email-1/fallback.bin",
    ]);
  });

  it("raises legacy not-found errors for missing emails or attachments", async () => {
    const missingEmailService = createEmailLifecycleService({
      repository: makeRepository({
        async findEmailForUser() {
          return undefined;
        },
      }),
    });
    const missingAttachmentService = createEmailLifecycleService({
      repository: makeRepository({
        async findEmailForUser() {
          return makeEmail({ attachments: [{ filename: "only.txt" }] });
        },
      }),
    });

    await expect(
      missingEmailService.listAttachments("user-1", "missing"),
    ).rejects.toMatchObject({
      name: "EmailLifecycleServiceError",
      code: "email_not_found",
      message: "Email not found",
    });
    await expect(
      missingAttachmentService.getAttachment("user-1", "email-1", "missing"),
    ).rejects.toMatchObject({
      code: "attachment_not_found",
      message: "Attachment not found",
    });
  });

  it("cancels only scheduled emails with scoped update semantics", async () => {
    let capturedUpdate:
      | { id: string; userId: string; status: string }
      | undefined;
    const service = createEmailLifecycleService({
      repository: makeRepository({
        async findEmailForUser(id) {
          return makeEmail({ id, status: "scheduled" });
        },
        async updateEmailStatusForUser(id, userId, status) {
          capturedUpdate = { id, userId, status };
          return { id, status };
        },
      }),
    });

    await expect(service.cancelEmail("user-1", "email-1")).resolves.toEqual({
      object: "email",
      id: "email-1",
      status: "canceled",
    });
    expect(capturedUpdate).toEqual({
      id: "email-1",
      userId: "user-1",
      status: "canceled",
    });
  });

  it("rejects cancel for non-scheduled emails with the legacy message", async () => {
    const service = createEmailLifecycleService({
      repository: makeRepository({
        async findEmailForUser() {
          return makeEmail({ status: "delivered" });
        },
      }),
    });

    await expect(service.cancelEmail("user-1", "email-1")).rejects.toEqual(
      new EmailLifecycleServiceError(
        "invalid_state",
        "Cannot cancel a delivered email",
      ),
    );
  });

  it("lists events after scoped parent lookup and preserves repository order", async () => {
    let capturedScope: { id: string; userId: string } | undefined;
    let capturedEmailId: string | undefined;
    const service = createEmailLifecycleService({
      repository: makeRepository({
        async findEmailForUser(id, userId) {
          capturedScope = { id, userId };
          return makeEmail({ id });
        },
        async listEventsByEmailIdAsc(emailId) {
          capturedEmailId = emailId;
          return [
            makeEvent({
              id: "event-1",
              type: "queued",
              receivedAt: new Date("2026-05-01T00:00:00.000Z"),
            }),
            makeEvent({
              id: "event-2",
              type: "delivered",
              receivedAt: new Date("2026-05-01T00:01:00.000Z"),
            }),
          ];
        },
      }),
    });

    await expect(service.listEvents("user-1", "email-1")).resolves.toEqual({
      object: "list",
      data: [
        {
          object: "email_event",
          id: "event-1",
          type: "queued",
          payload: { delivery: true },
          created_at: new Date("2026-05-01T00:00:00.000Z"),
          summary: "Provider event recorded",
          details: {},
        },
        {
          object: "email_event",
          id: "event-2",
          type: "delivered",
          payload: { delivery: true },
          created_at: new Date("2026-05-01T00:01:00.000Z"),
          summary: "Delivered",
          details: {},
        },
      ],
    });
    expect(capturedScope).toEqual({ id: "email-1", userId: "user-1" });
    expect(capturedEmailId).toBe("email-1");
  });

  it("adds bounded sanitized event trace details without removing legacy payload", async () => {
    const service = createEmailLifecycleService({
      repository: makeRepository({
        async listEventsByEmailIdAsc() {
          return [
            makeEvent({
              id: "event-bounce",
              type: "bounced",
              payload: {
                bounceType: "Permanent",
                bounceSubType: "General",
                bouncedRecipients: [
                  {
                    emailAddress: "recipient@example.com",
                    action: "failed",
                    status: "5.1.1",
                    diagnosticCode: "smtp; 550 5.1.1 user unknown",
                  },
                ],
                authorization: "Bearer should-not-render",
                html: "<p>body should not render</p>",
              },
              receivedAt: new Date("2026-05-01T00:01:00.000Z"),
            }),
          ];
        },
      }),
    });

    await expect(service.listEvents("user-1", "email-1")).resolves.toEqual({
      object: "list",
      data: [
        {
          object: "email_event",
          id: "event-bounce",
          type: "bounced",
          payload: {
            bounceType: "Permanent",
            bounceSubType: "General",
            bouncedRecipients: [
              {
                emailAddress: "recipient@example.com",
                action: "failed",
                status: "5.1.1",
                diagnosticCode: "smtp; 550 5.1.1 user unknown",
              },
            ],
            authorization: "Bearer should-not-render",
            html: "<p>body should not render</p>",
          },
          created_at: new Date("2026-05-01T00:01:00.000Z"),
          summary:
            "Permanent bounce — for recipient@example.com — smtp; 550 5.1.1 user unknown",
          details: {
            bounce_type: "Permanent",
            bounce_subtype: "General",
            diagnostic_code: "smtp; 550 5.1.1 user unknown",
            status: "5.1.1",
            action: "failed",
            recipients: ["recipient@example.com"],
          },
        },
      ],
    });
  });
});
