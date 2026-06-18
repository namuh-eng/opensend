import {
  type ReceivedEmailRepository,
  ReceivedEmailServiceError,
  createReceivedEmailService,
} from "@opensend/core";
import { describe, expect, it } from "vitest";

type ReceivedEmailRow = NonNullable<
  Awaited<ReturnType<ReceivedEmailRepository["findById"]>>
>;
type ListOptions = Parameters<ReceivedEmailRepository["listForApi"]>[0];

type AttachmentContainer = NonNullable<
  Awaited<ReturnType<ReceivedEmailRepository["findAttachmentsByEmailId"]>>
>;

function makeReceivedEmail(
  overrides: Partial<ReceivedEmailRow> = {},
): ReceivedEmailRow {
  return {
    id: "received-1",
    from: "sender@example.com",
    to: ["user@example.com"],
    subject: "Inbound",
    html: "<p>Hello</p>",
    text: "Hello",
    status: "received",
    routeDecisions: null,
    attachments: [
      {
        id: "att-1",
        filename: "invoice.pdf",
        contentType: "application/pdf",
        size: 1234,
        s3Key: "received/received-1/invoice.pdf",
      },
    ],
    headers: null,
    replyMatchStatus: "unmatched",
    threadId: null,
    replyToEmailId: null,
    contactId: null,
    createdAt: new Date("2026-05-10T00:00:00.000Z"),
    userId: null,
    ...overrides,
  };
}

function makeRepository(
  overrides: Partial<ReceivedEmailRepository> = {},
): ReceivedEmailRepository {
  return {
    async listForApi() {
      return { data: [], hasMore: false };
    },
    async findById() {
      return makeReceivedEmail();
    },
    async findAttachmentsByEmailId() {
      return { attachments: makeReceivedEmail().attachments };
    },
    ...overrides,
  };
}

describe("received email service boundary", () => {
  it("normalizes list pagination and recipient filters while preserving response shape", async () => {
    let capturedOptions: ListOptions | undefined;
    const service = createReceivedEmailService({
      repository: makeRepository({
        async listForApi(options) {
          capturedOptions = options;
          return {
            hasMore: true,
            data: [
              makeReceivedEmail({
                id: "received-2",
                subject: "Filtered",
              }),
            ],
          };
        },
      }),
    });

    const result = await service.listReceivedEmails({
      userId: "tenant-1",
      limit: 500,
      after: "received-1",
      to: " User@Example.com ",
    });

    expect(capturedOptions).toEqual({
      userId: "tenant-1",
      limit: 100,
      after: "received-1",
      to: "user@example.com",
    });
    expect(result).toEqual({
      object: "list",
      has_more: true,
      data: [
        {
          id: "received-2",
          from: "sender@example.com",
          to: ["user@example.com"],
          subject: "Filtered",
          route_decisions: [],
          reply_match_status: "unmatched",
          thread_id: null,
          reply_to_email_id: null,
          contact_id: null,
          created_at: new Date("2026-05-10T00:00:00.000Z"),
        },
      ],
    });
  });

  it("uses the legacy default limit and drops empty filters", async () => {
    let capturedOptions: ListOptions | undefined;
    const service = createReceivedEmailService({
      repository: makeRepository({
        async listForApi(options) {
          capturedOptions = options;
          return { data: [], hasMore: false };
        },
      }),
    });

    await service.listReceivedEmails({
      userId: "tenant-1",
      limit: Number.NaN,
      after: "",
      to: "  ",
    });

    expect(capturedOptions).toEqual({
      userId: "tenant-1",
      limit: 20,
      after: undefined,
      to: undefined,
    });
  });

  it("maps received email detail and raises the legacy not-found message", async () => {
    const service = createReceivedEmailService({
      repository: makeRepository({
        async findById(id) {
          return makeReceivedEmail({ id });
        },
      }),
    });

    await expect(
      service.getReceivedEmail("received-9", "tenant-1"),
    ).resolves.toEqual({
      object: "received_email",
      id: "received-9",
      from: "sender@example.com",
      to: ["user@example.com"],
      subject: "Inbound",
      html: "<p>Hello</p>",
      text: "Hello",
      route_decisions: [],
      reply_match_status: "unmatched",
      thread_id: null,
      reply_to_email_id: null,
      contact_id: null,
      thread: {
        thread_id: null,
        match_status: "unmatched",
        original_email_id: null,
        contact_id: null,
        messages: [
          {
            id: "received-9",
            direction: "inbound",
            subject: "Inbound",
            from: "sender@example.com",
            to: ["user@example.com"],
            text: "Hello",
            html: "<p>Hello</p>",
            created_at: new Date("2026-05-10T00:00:00.000Z"),
          },
        ],
      },
      created_at: new Date("2026-05-10T00:00:00.000Z"),
    });

    const missingService = createReceivedEmailService({
      repository: makeRepository({
        async findById() {
          return undefined;
        },
      }),
    });

    await expect(
      missingService.getReceivedEmail("missing", "tenant-1"),
    ).rejects.toEqual(
      new ReceivedEmailServiceError(
        "received_email_not_found",
        "Received email not found",
      ),
    );
  });

  it("maps attachment list and detail payloads with stable expiration", async () => {
    let capturedKey: string | undefined;
    const container: AttachmentContainer = {
      attachments: makeReceivedEmail().attachments,
    };
    const service = createReceivedEmailService({
      repository: makeRepository({
        async findAttachmentsByEmailId() {
          return container;
        },
      }),
      getPresignedUrl: async (key) => {
        capturedKey = key;
        return `https://storage.test/${key}`;
      },
      now: () => new Date("2026-05-10T12:00:00.000Z"),
    });

    await expect(
      service.listAttachments("received-1", "tenant-1"),
    ).resolves.toEqual({
      object: "list",
      data: [
        {
          id: "att-1",
          filename: "invoice.pdf",
          content_type: "application/pdf",
          size: 1234,
        },
      ],
    });

    await expect(
      service.getAttachment("received-1", "att-1", "tenant-1"),
    ).resolves.toEqual({
      object: "received_email_attachment",
      id: "att-1",
      filename: "invoice.pdf",
      content_type: "application/pdf",
      size: 1234,
      download_url: "https://storage.test/received/received-1/invoice.pdf",
      expires_at: "2026-05-10T13:00:00.000Z",
    });
    expect(capturedKey).toBe("received/received-1/invoice.pdf");
  });

  it("raises not-found errors for missing attachment rows and ids", async () => {
    const missingEmailService = createReceivedEmailService({
      repository: makeRepository({
        async findAttachmentsByEmailId() {
          return undefined;
        },
      }),
    });

    await expect(
      missingEmailService.listAttachments("missing", "tenant-1"),
    ).rejects.toEqual(
      new ReceivedEmailServiceError(
        "received_email_not_found",
        "Received email not found",
      ),
    );

    const missingAttachmentService = createReceivedEmailService({
      repository: makeRepository(),
    });

    await expect(
      missingAttachmentService.getAttachment(
        "received-1",
        "missing",
        "tenant-1",
      ),
    ).rejects.toEqual(
      new ReceivedEmailServiceError(
        "attachment_not_found",
        "Attachment not found",
      ),
    );
  });
});
