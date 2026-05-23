import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mock SES SDK ──────────────────────────────────────────────────────────────
const mockSend = vi.hoisted(() => vi.fn());
const MockSendEmailCommand = vi.hoisted(() =>
  vi.fn().mockImplementation((input) => ({ _input: input })),
);

vi.mock("@aws-sdk/client-sesv2", () => ({
  SESv2Client: vi.fn().mockImplementation(() => ({ send: mockSend })),
  SendEmailCommand: MockSendEmailCommand,
  CreateEmailIdentityCommand: vi.fn(),
  DeleteEmailIdentityCommand: vi.fn(),
  GetEmailIdentityCommand: vi.fn(),
  PutEmailIdentityDkimSigningAttributesCommand: vi.fn(),
}));

vi.stubEnv("NODE_ENV", "production");
vi.stubEnv("AWS_ACCESS_KEY_ID", "test-key");
vi.stubEnv("AWS_SECRET_ACCESS_KEY", "test-secret");

import { EmailProviderService } from "@opensend/core";

describe("EmailProviderService.sendEmail with configurationSetName", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes ConfigurationSetName in SendEmailCommand when provided", async () => {
    mockSend.mockResolvedValueOnce({ MessageId: "msg-123" });
    const svc = new EmailProviderService();

    await svc.sendEmail({
      from: "sender@example.com",
      to: ["recipient@example.com"],
      subject: "Hello",
      html: "<p>Hello</p>",
      configurationSetName: "opensend-domain-abc123",
    });

    expect(MockSendEmailCommand).toHaveBeenCalledOnce();
    const callArg = MockSendEmailCommand.mock.calls[0][0];
    expect(callArg.ConfigurationSetName).toBe("opensend-domain-abc123");
  });

  it("omits ConfigurationSetName when not provided", async () => {
    mockSend.mockResolvedValueOnce({ MessageId: "msg-456" });
    const svc = new EmailProviderService();

    await svc.sendEmail({
      from: "sender@example.com",
      to: ["recipient@example.com"],
      subject: "Hello",
      html: "<p>Hello</p>",
    });

    expect(MockSendEmailCommand).toHaveBeenCalledOnce();
    const callArg = MockSendEmailCommand.mock.calls[0][0];
    expect(callArg.ConfigurationSetName).toBeUndefined();
  });

  it("omits ConfigurationSetName when null", async () => {
    mockSend.mockResolvedValueOnce({ MessageId: "msg-789" });
    const svc = new EmailProviderService();

    await svc.sendEmail({
      from: "sender@example.com",
      to: ["recipient@example.com"],
      subject: "Hello",
      configurationSetName: null,
    });

    expect(MockSendEmailCommand).toHaveBeenCalledOnce();
    const callArg = MockSendEmailCommand.mock.calls[0][0];
    expect(callArg.ConfigurationSetName).toBeUndefined();
  });
});
