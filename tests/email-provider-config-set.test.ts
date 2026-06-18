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

  it("stamps a trusted entity id header and SES message tag for simple sends", async () => {
    mockSend.mockResolvedValueOnce({ MessageId: "msg-entity" });
    const svc = new EmailProviderService();

    await svc.sendEmail({
      from: "sender@example.com",
      to: ["recipient@example.com"],
      subject: "Hello",
      html: "<p>Hello</p>",
      headers: {
        "x-entity-id": "attacker-controlled",
        "X-Customer-Header": "kept",
      },
      emailId: "550e8400-e29b-41d4-a716-446655440000",
    });

    const callArg = MockSendEmailCommand.mock.calls[0][0];
    expect(callArg.EmailTags).toEqual([
      {
        Name: "X-Entity-ID",
        Value: "550e8400-e29b-41d4-a716-446655440000",
      },
    ]);
    expect(callArg.Content.Simple.Headers).toEqual([
      { Name: "X-Customer-Header", Value: "kept" },
      {
        Name: "X-Entity-ID",
        Value: "550e8400-e29b-41d4-a716-446655440000",
      },
    ]);
  });

  it("stamps a trusted entity id header and SES message tag for raw attachment sends", async () => {
    mockSend.mockResolvedValueOnce({ MessageId: "msg-raw-entity" });
    const svc = new EmailProviderService();

    await svc.sendEmail({
      from: "sender@example.com",
      to: ["recipient@example.com"],
      subject: "Hello",
      html: "<p>Hello</p>",
      headers: { "X-Entity-ID": "attacker-controlled" },
      attachments: [{ filename: "hello.txt", content: "aGVsbG8=" }],
      emailId: "550e8400-e29b-41d4-a716-446655440000",
    });

    const callArg = MockSendEmailCommand.mock.calls[0][0];
    const rawMessage = new TextDecoder().decode(callArg.Content.Raw.Data);
    expect(callArg.EmailTags).toEqual([
      {
        Name: "X-Entity-ID",
        Value: "550e8400-e29b-41d4-a716-446655440000",
      },
    ]);
    expect(rawMessage).toContain(
      "X-Entity-ID: 550e8400-e29b-41d4-a716-446655440000",
    );
    expect(rawMessage).not.toContain("attacker-controlled");
  });
});
