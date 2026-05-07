import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the AWS SES SDK — vi.hoisted ensures mockSend is available during mock factory
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

import {
  type SendEmailInput,
  createDomainIdentity,
  deleteDomainIdentity,
  getDomainIdentity,
  sendEmail,
} from "@/lib/ses";

describe("SES Client", () => {
  beforeEach(() => {
    mockSend.mockReset();
  });

  describe("sendEmail", () => {
    it("sends a basic email and returns message ID", async () => {
      mockSend.mockResolvedValueOnce({
        MessageId: "ses-msg-123",
      });

      const input: SendEmailInput = {
        from: "Acme <hello@acme.com>",
        to: ["user@example.com"],
        subject: "Hello World",
        html: "<p>Hello</p>",
      };

      const result = await sendEmail(input);

      expect(result).toEqual({ id: "ses-msg-123" });
      expect(mockSend).toHaveBeenCalledOnce();
    });

    it("sends email with all optional fields", async () => {
      mockSend.mockResolvedValueOnce({
        MessageId: "ses-msg-456",
      });

      const input: SendEmailInput = {
        from: "Acme <hello@acme.com>",
        to: ["user@example.com"],
        cc: ["cc@example.com"],
        bcc: ["bcc@example.com"],
        subject: "Full Email",
        html: "<p>Hello</p>",
        text: "Hello",
        replyTo: ["reply@example.com"],
        headers: { "X-Custom": "value" },
      };

      const result = await sendEmail(input);

      expect(result).toEqual({ id: "ses-msg-456" });
      expect(mockSend).toHaveBeenCalledOnce();
    });

    it("sends email with text-only body", async () => {
      mockSend.mockResolvedValueOnce({
        MessageId: "ses-msg-789",
      });

      const input: SendEmailInput = {
        from: "Acme <hello@acme.com>",
        to: ["user@example.com"],
        subject: "Text Only",
        text: "Plain text body",
      };

      const result = await sendEmail(input);

      expect(result).toEqual({ id: "ses-msg-789" });
    });

    it("sends email with multiple recipients", async () => {
      mockSend.mockResolvedValueOnce({
        MessageId: "ses-msg-multi",
      });

      const input: SendEmailInput = {
        from: "Acme <hello@acme.com>",
        to: ["a@example.com", "b@example.com", "c@example.com"],
        subject: "Multi",
        html: "<p>Hi all</p>",
      };

      const result = await sendEmail(input);

      expect(result).toEqual({ id: "ses-msg-multi" });
    });

    it("throws validation error when from is missing", async () => {
      const input = {
        to: ["user@example.com"],
        subject: "No From",
        html: "<p>Hello</p>",
      } as SendEmailInput;

      await expect(sendEmail(input)).rejects.toThrow("from is required");
      expect(mockSend).not.toHaveBeenCalled();
    });

    it("throws validation error when to is missing", async () => {
      const input = {
        from: "hello@acme.com",
        subject: "No To",
        html: "<p>Hello</p>",
      } as SendEmailInput;

      await expect(sendEmail(input)).rejects.toThrow("to is required");
      expect(mockSend).not.toHaveBeenCalled();
    });

    it("throws validation error when to is empty array", async () => {
      const input: SendEmailInput = {
        from: "hello@acme.com",
        to: [],
        subject: "Empty To",
        html: "<p>Hello</p>",
      };

      await expect(sendEmail(input)).rejects.toThrow("to is required");
    });

    it("throws validation error when subject is missing", async () => {
      const input = {
        from: "hello@acme.com",
        to: ["user@example.com"],
        html: "<p>Hello</p>",
      } as SendEmailInput;

      await expect(sendEmail(input)).rejects.toThrow("subject is required");
    });

    it("throws validation error when no body provided", async () => {
      const input = {
        from: "hello@acme.com",
        to: ["user@example.com"],
        subject: "No Body",
      } as SendEmailInput;

      await expect(sendEmail(input)).rejects.toThrow(
        "html or text body is required",
      );
    });

    it("wraps SES errors with descriptive message", async () => {
      mockSend.mockRejectedValueOnce(new Error("SES rate limit exceeded"));

      const input: SendEmailInput = {
        from: "hello@acme.com",
        to: ["user@example.com"],
        subject: "Test",
        html: "<p>Hello</p>",
      };

      await expect(sendEmail(input)).rejects.toThrow("SES rate limit exceeded");
    });

    it("sends email with attachments", async () => {
      mockSend.mockResolvedValueOnce({
        MessageId: "ses-msg-attach",
      });

      const input: SendEmailInput = {
        from: "hello@acme.com",
        to: ["user@example.com"],
        subject: "With Attachment",
        html: "<p>See attached</p>",
        attachments: [{ filename: "test.txt", content: "SGVsbG8gV29ybGQ=" }],
      };

      const result = await sendEmail(input);

      expect(result).toEqual({ id: "ses-msg-attach" });
      expect(mockSend).toHaveBeenCalledOnce();
    });
  });

  describe("createDomainIdentity", () => {
    it("creates a domain identity and returns DKIM tokens", async () => {
      mockSend.mockResolvedValueOnce({
        DkimAttributes: {
          Tokens: ["token1", "token2", "token3"],
          SigningEnabled: true,
          Status: "PENDING",
        },
      });

      const result = await createDomainIdentity("example.com");

      expect(result).toEqual({
        dkimTokens: ["token1", "token2", "token3"],
        status: "PENDING",
      });
      expect(mockSend).toHaveBeenCalledOnce();
    });

    it("throws when domain name is empty", async () => {
      await expect(createDomainIdentity("")).rejects.toThrow(
        "domain is required",
      );
      expect(mockSend).not.toHaveBeenCalled();
    });

    it("adopts an existing SES identity when AlreadyExistsException is thrown", async () => {
      const alreadyExists = Object.assign(new Error("identity exists"), {
        name: "AlreadyExistsException",
      });
      mockSend.mockRejectedValueOnce(alreadyExists);
      mockSend.mockResolvedValueOnce({
        VerifiedForSendingStatus: true,
        DkimAttributes: {
          Tokens: ["existing1", "existing2", "existing3"],
          Status: "SUCCESS",
        },
      });

      const result = await createDomainIdentity("foreverbrowsing.com");

      expect(result).toEqual({
        dkimTokens: ["existing1", "existing2", "existing3"],
        status: "SUCCESS",
      });
      expect(mockSend).toHaveBeenCalledTimes(2);
    });

    it("rethrows non-AlreadyExists SES errors", async () => {
      mockSend.mockRejectedValueOnce(
        Object.assign(new Error("denied"), { name: "AccessDeniedException" }),
      );
      await expect(createDomainIdentity("example.com")).rejects.toThrow(
        "denied",
      );
      expect(mockSend).toHaveBeenCalledOnce();
    });
  });

  describe("getDomainIdentity", () => {
    it("returns domain verification status and DKIM records", async () => {
      mockSend.mockResolvedValueOnce({
        VerifiedForSendingStatus: true,
        DkimAttributes: {
          Tokens: ["token1", "token2", "token3"],
          SigningEnabled: true,
          Status: "SUCCESS",
          CurrentSigningKeyLength: "RSA_2048_BIT",
        },
      });

      const result = await getDomainIdentity("example.com");

      expect(result).toEqual({
        verified: true,
        dkimStatus: "SUCCESS",
        dkimTokens: ["token1", "token2", "token3"],
      });
    });
  });

  describe("deleteDomainIdentity", () => {
    it("deletes a domain identity", async () => {
      mockSend.mockResolvedValueOnce({});

      await expect(deleteDomainIdentity("example.com")).resolves.not.toThrow();
      expect(mockSend).toHaveBeenCalledOnce();
    });

    it("throws when domain name is empty", async () => {
      await expect(deleteDomainIdentity("")).rejects.toThrow(
        "domain is required",
      );
    });
  });
});
