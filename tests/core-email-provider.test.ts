import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockSend, mockSesClient } = vi.hoisted(() => ({
  mockSend: vi.fn(),
  mockSesClient: vi.fn(),
}));

vi.mock("@aws-sdk/client-sesv2", () => ({
  SESv2Client: mockSesClient.mockImplementation(() => ({
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
  PutEmailIdentityDkimSigningAttributesCommand: vi
    .fn()
    .mockImplementation((input) => ({
      ...input,
      _type: "PutEmailIdentityDkimSigningAttributesCommand",
    })),
}));

describe("EmailProviderService", () => {
  const previousAccessKey = process.env.AWS_ACCESS_KEY_ID;
  const previousSecretKey = process.env.AWS_SECRET_ACCESS_KEY;
  const previousProfile = process.env.AWS_PROFILE;
  const previousNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    vi.resetModules();
    mockSend.mockReset();
    mockSesClient.mockClear();
    process.env.AWS_ACCESS_KEY_ID = "test-key";
  });

  afterEach(() => {
    if (previousAccessKey === undefined) {
      process.env.AWS_ACCESS_KEY_ID = undefined;
    } else {
      process.env.AWS_ACCESS_KEY_ID = previousAccessKey;
    }
    if (previousSecretKey === undefined) {
      process.env.AWS_SECRET_ACCESS_KEY = undefined;
    } else {
      process.env.AWS_SECRET_ACCESS_KEY = previousSecretKey;
    }
    if (previousProfile === undefined) {
      process.env.AWS_PROFILE = undefined;
    } else {
      process.env.AWS_PROFILE = previousProfile;
    }
    if (previousNodeEnv === undefined) {
      (process.env as Record<string, string | undefined>).NODE_ENV = undefined;
    } else {
      (process.env as Record<string, string | undefined>).NODE_ENV =
        previousNodeEnv;
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

  it("rejects CRLF injection in raw MIME headers before sending", async () => {
    const { EmailProviderService } = await import(
      "../packages/core/src/services/emailProvider"
    );
    const provider = new EmailProviderService();

    await expect(
      provider.sendEmail({
        from: "hello@example.com",
        to: ["user@example.com"],
        subject: "Hello\r\nBcc: attacker@example.com",
        html: "<p>Hello</p>",
        attachments: [{ filename: "note.txt", content: "aGVsbG8=" }],
      }),
    ).rejects.toMatchObject({ code: "MIME_HEADER_INJECTION" });

    expect(mockSend).not.toHaveBeenCalled();
  });

  it("creates and reuses SES clients per requested region", async () => {
    mockSend
      .mockResolvedValueOnce({ MessageId: "eu-message" })
      .mockResolvedValueOnce({
        DkimAttributes: { Tokens: [], Status: "PENDING" },
      })
      .mockResolvedValueOnce({ VerifiedForSendingStatus: true })
      .mockResolvedValueOnce({});

    const { EmailProviderService } = await import(
      "../packages/core/src/services/emailProvider"
    );
    const provider = new EmailProviderService();

    await provider.sendEmail({
      from: "hello@example.com",
      to: ["user@example.com"],
      subject: "Hello",
      html: "<p>Hello</p>",
      region: "eu-west-1",
    });
    await provider.createDomainIdentity("example.com", { region: "eu-west-1" });
    await provider.getDomainIdentity("example.com", { region: "eu-west-1" });
    await provider.deleteDomainIdentity("example.com", { region: "eu-west-1" });

    expect(mockSesClient).toHaveBeenCalledTimes(1);
    expect(mockSesClient).toHaveBeenCalledWith({ region: "eu-west-1" });
    expect(mockSend).toHaveBeenCalledTimes(4);
  });

  it("uses the SES client in production without static AWS access key env vars", async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    process.env.AWS_ACCESS_KEY_ID = undefined;
    process.env.AWS_SECRET_ACCESS_KEY = undefined;
    process.env.AWS_PROFILE = undefined;
    mockSend.mockResolvedValueOnce({ MessageId: "ecs-role-message" });

    const { EmailProviderService } = await import(
      "../packages/core/src/services/emailProvider"
    );
    const provider = new EmailProviderService();

    await expect(
      provider.sendEmail({
        from: "hello@example.com",
        to: ["user@example.com"],
        subject: "Hello",
        html: "<p>Hello</p>",
      }),
    ).resolves.toEqual({ id: "ecs-role-message" });

    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it("defaults SES client selection to us-east-1", async () => {
    mockSend.mockResolvedValueOnce({ MessageId: "default-message" });
    const { EmailProviderService } = await import(
      "../packages/core/src/services/emailProvider"
    );
    const provider = new EmailProviderService();

    await provider.sendEmail({
      from: "hello@example.com",
      to: ["user@example.com"],
      subject: "Hello",
      html: "<p>Hello</p>",
    });

    expect(mockSesClient).toHaveBeenCalledWith({ region: "us-east-1" });
  });
});
