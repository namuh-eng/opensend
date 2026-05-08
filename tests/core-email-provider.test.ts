import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockSend } = vi.hoisted(() => ({
  mockSend: vi.fn(),
}));

vi.mock("@aws-sdk/client-sesv2", () => ({
  SESv2Client: vi.fn().mockImplementation(() => ({
    send: mockSend,
  })),
  SendEmailCommand: vi.fn().mockImplementation((input) => ({
    ...input,
    _type: "SendEmailCommand",
  })),
  CreateEmailIdentityCommand: vi.fn().mockImplementation((input) => ({
    ...input,
    _type: "CreateEmailIdentityCommand",
  })),
  GetEmailIdentityCommand: vi.fn().mockImplementation((input) => ({
    ...input,
    _type: "GetEmailIdentityCommand",
  })),
  DeleteEmailIdentityCommand: vi.fn().mockImplementation((input) => ({
    ...input,
    _type: "DeleteEmailIdentityCommand",
  })),
}));

describe("EmailProviderService", () => {
  const previousAccessKey = process.env.AWS_ACCESS_KEY_ID;

  beforeEach(() => {
    vi.resetModules();
    mockSend.mockReset();
    process.env.AWS_ACCESS_KEY_ID = "test-key";
  });

  afterEach(() => {
    if (previousAccessKey === undefined) {
      process.env.AWS_ACCESS_KEY_ID = undefined;
    } else {
      process.env.AWS_ACCESS_KEY_ID = previousAccessKey;
    }
  });

  it("uses raw MIME for attachments with content type and Content-ID", async () => {
    mockSend.mockResolvedValueOnce({ MessageId: "ses-core-cid" });
    const { EmailProviderService } = await import(
      "../packages/core/src/services/emailProvider"
    );
    const provider = new EmailProviderService();

    await expect(
      provider.sendEmail({
        from: "hello@example.com",
        to: ["user@example.com"],
        subject: "CID",
        html: '<img src="cid:logo" />',
        attachments: [
          {
            filename: "logo.bin",
            content: "aW1hZ2U=",
            content_type: "image/png",
            content_id: "logo",
          },
        ],
      }),
    ).resolves.toEqual({ id: "ses-core-cid" });

    const command = mockSend.mock.calls[0]?.[0] as {
      Content?: { Raw?: { Data?: Uint8Array }; Simple?: unknown };
    };
    expect(command.Content?.Simple).toBeUndefined();
    const raw = new TextDecoder().decode(command.Content?.Raw?.Data);
    expect(raw).toContain('Content-Type: image/png; name="logo.bin"');
    expect(raw).toContain("Content-ID: <logo>");
    expect(raw).toContain('Content-Disposition: inline; filename="logo.bin"');
    expect(raw).toContain("aW1hZ2U=");
  });
});
