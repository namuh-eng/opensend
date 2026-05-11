import { beforeEach, describe, expect, it, vi } from "vitest";

const mockValidateApiKey = vi.hoisted(() => vi.fn());
const mockReceivedEmailService = vi.hoisted(() => ({
  listReceivedEmails: vi.fn(),
  getReceivedEmail: vi.fn(),
  listAttachments: vi.fn(),
  getAttachment: vi.fn(),
}));

const MockReceivedEmailServiceError = vi.hoisted(
  () =>
    class ReceivedEmailServiceError extends Error {
      constructor(
        readonly code: string,
        message: string,
      ) {
        super(message);
        this.name = "ReceivedEmailServiceError";
      }
    },
);

vi.mock("@opensend/core", () => ({
  ReceivedEmailServiceError: MockReceivedEmailServiceError,
  createReceivedEmailService: () => mockReceivedEmailService,
}));

vi.mock("@/lib/api-auth", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/api-auth")>("@/lib/api-auth");
  return {
    validateApiKey: mockValidateApiKey,
    unauthorizedResponse: actual.unauthorizedResponse,
  };
});

const AUTH_RESULT = {
  apiKeyId: "key-uuid",
  permission: "full_access",
  domain: null,
  userId: "user-1",
};

describe("received email API route boundary", () => {
  beforeEach(() => {
    vi.resetModules();
    mockValidateApiKey.mockResolvedValue(AUTH_RESULT);
    mockReceivedEmailService.listReceivedEmails.mockReset();
    mockReceivedEmailService.getReceivedEmail.mockReset();
    mockReceivedEmailService.listAttachments.mockReset();
    mockReceivedEmailService.getAttachment.mockReset();
  });

  it("delegates list pagination and recipient filters to the service", async () => {
    mockReceivedEmailService.listReceivedEmails.mockResolvedValueOnce({
      object: "list",
      data: [
        {
          id: "received-1",
          from: "sender@example.com",
          to: ["user@example.com"],
          subject: "Inbound",
          created_at: new Date("2026-05-10T00:00:00.000Z"),
        },
      ],
      has_more: false,
    });

    const { GET } = await import("@/app/api/emails/receiving/route");
    const response = await GET(
      new Request(
        "http://localhost:3015/api/emails/receiving?limit=2&after=received-0&to=User@Example.com",
        { headers: { Authorization: "Bearer os_test123" } },
      ),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      object: "list",
      data: [
        {
          id: "received-1",
          from: "sender@example.com",
          to: ["user@example.com"],
          subject: "Inbound",
          created_at: "2026-05-10T00:00:00.000Z",
        },
      ],
      has_more: false,
    });
    expect(mockReceivedEmailService.listReceivedEmails).toHaveBeenCalledWith({
      limit: 2,
      after: "received-0",
      to: "User@Example.com",
    });
  });

  it("returns received email detail from the service", async () => {
    mockReceivedEmailService.getReceivedEmail.mockResolvedValueOnce({
      object: "received_email",
      id: "received-1",
      from: "sender@example.com",
      to: ["user@example.com"],
      subject: "Inbound",
      html: "<p>Hello</p>",
      text: "Hello",
      created_at: new Date("2026-05-10T00:00:00.000Z"),
    });

    const { GET } = await import("@/app/api/emails/receiving/[id]/route");
    const response = await GET(
      new Request("http://localhost:3015/api/emails/receiving/received-1", {
        headers: { Authorization: "Bearer os_test123" },
      }),
      { params: Promise.resolve({ id: "received-1" }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      object: "received_email",
      id: "received-1",
      created_at: "2026-05-10T00:00:00.000Z",
    });
    expect(mockReceivedEmailService.getReceivedEmail).toHaveBeenCalledWith(
      "received-1",
    );
  });

  it("preserves the received email not-found response", async () => {
    mockReceivedEmailService.getReceivedEmail.mockRejectedValueOnce(
      new MockReceivedEmailServiceError(
        "received_email_not_found",
        "Received email not found",
      ),
    );

    const { GET } = await import("@/app/api/emails/receiving/[id]/route");
    const response = await GET(
      new Request("http://localhost:3015/api/emails/receiving/missing", {
        headers: { Authorization: "Bearer os_test123" },
      }),
      { params: Promise.resolve({ id: "missing" }) },
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "Received email not found",
    });
  });

  it("returns the service attachment list response unchanged", async () => {
    mockReceivedEmailService.listAttachments.mockResolvedValueOnce({
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

    const { GET } = await import(
      "@/app/api/emails/receiving/[id]/attachments/route"
    );
    const response = await GET(
      new Request(
        "http://localhost:3015/api/emails/receiving/received-1/attachments",
        { headers: { Authorization: "Bearer os_test123" } },
      ),
      { params: Promise.resolve({ id: "received-1" }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
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
    expect(mockReceivedEmailService.listAttachments).toHaveBeenCalledWith(
      "received-1",
    );
  });

  it("preserves attachment list email-not-found responses", async () => {
    mockReceivedEmailService.listAttachments.mockRejectedValueOnce(
      new MockReceivedEmailServiceError(
        "received_email_not_found",
        "Received email not found",
      ),
    );

    const { GET } = await import(
      "@/app/api/emails/receiving/[id]/attachments/route"
    );
    const response = await GET(
      new Request(
        "http://localhost:3015/api/emails/receiving/missing/attachments",
        { headers: { Authorization: "Bearer os_test123" } },
      ),
      { params: Promise.resolve({ id: "missing" }) },
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "Received email not found",
    });
  });

  it("returns attachment detail from the service", async () => {
    mockReceivedEmailService.getAttachment.mockResolvedValueOnce({
      object: "received_email_attachment",
      id: "att-1",
      filename: "invoice.pdf",
      content_type: "application/pdf",
      size: 1234,
      download_url: "https://storage.test/invoice.pdf",
      expires_at: "2026-05-10T13:00:00.000Z",
    });

    const { GET } = await import(
      "@/app/api/emails/receiving/[id]/attachments/[attachmentId]/route"
    );
    const response = await GET(
      new Request(
        "http://localhost:3015/api/emails/receiving/received-1/attachments/att-1",
        { headers: { Authorization: "Bearer os_test123" } },
      ),
      {
        params: Promise.resolve({ id: "received-1", attachmentId: "att-1" }),
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      object: "received_email_attachment",
      id: "att-1",
      filename: "invoice.pdf",
      content_type: "application/pdf",
      size: 1234,
      download_url: "https://storage.test/invoice.pdf",
      expires_at: "2026-05-10T13:00:00.000Z",
    });
    expect(mockReceivedEmailService.getAttachment).toHaveBeenCalledWith(
      "received-1",
      "att-1",
    );
  });

  it("preserves attachment-not-found responses", async () => {
    mockReceivedEmailService.getAttachment.mockRejectedValueOnce(
      new MockReceivedEmailServiceError(
        "attachment_not_found",
        "Attachment not found",
      ),
    );

    const { GET } = await import(
      "@/app/api/emails/receiving/[id]/attachments/[attachmentId]/route"
    );
    const response = await GET(
      new Request(
        "http://localhost:3015/api/emails/receiving/received-1/attachments/missing",
        { headers: { Authorization: "Bearer os_test123" } },
      ),
      {
        params: Promise.resolve({
          id: "received-1",
          attachmentId: "missing",
        }),
      },
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "Attachment not found",
    });
  });
});
