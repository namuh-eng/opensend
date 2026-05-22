import type { Readable } from "node:stream";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocks ─────────────────────────────────────────────────────────────

const mockFindByUserAndEmails = vi.hoisted(() => vi.fn());
const mockEmailRepoCreate = vi.hoisted(() => vi.fn());
const mockEmailRepoUpdate = vi.hoisted(() => vi.fn());
const mockPublishBackgroundJob = vi.hoisted(() => vi.fn());
const mockCreateBackgroundJob = vi.hoisted(() =>
  vi.fn((job: Record<string, unknown>) => ({
    ...job,
    requestedAt: "2026-05-23T00:00:00.000Z",
  })),
);

vi.mock("@opensend/core", () => ({
  SuppressedRecipientError: class SuppressedRecipientError extends Error {
    readonly code = "recipient_suppressed";
    readonly statusCode = 422;
    constructor(readonly recipients: Array<{ email: string; reason: string }>) {
      const first = recipients[0];
      super(
        first
          ? `Recipient ${first.email} is suppressed because it ${first.reason}.`
          : "One or more recipients are suppressed.",
      );
      this.name = "SuppressedRecipientError";
    }
  },
  suppressionRepo: {
    findByUserAndEmails: mockFindByUserAndEmails,
  },
  emailRepo: {
    create: mockEmailRepoCreate,
    update: mockEmailRepoUpdate,
  },
  createBackgroundJob: mockCreateBackgroundJob,
  publishBackgroundJob: mockPublishBackgroundJob,
  createTelemetryContext: (input: { service: string; operation: string }) => ({
    service: input.service,
    operation: input.operation,
    correlationId: "test-corr-id",
    traceparent: "00-traceid-spanid-01",
  }),
  logTelemetry: vi.fn(),
  recordTelemetryError: vi.fn(),
}));

// ── Helpers ───────────────────────────────────────────────────────────

function makeRawMail(options: {
  from?: string;
  to?: string;
  subject?: string;
  html?: string;
  text?: string;
  cc?: string;
  bcc?: string;
}): string {
  const {
    from = "sender@example.com",
    to = "recipient@example.com",
    subject = "Test Subject",
    html,
    text = "Plain text body",
    cc,
    bcc,
  } = options;

  const lines = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    ...(cc ? [`Cc: ${cc}`] : []),
    ...(bcc ? [`Bcc: ${bcc}`] : []),
    "MIME-Version: 1.0",
  ];

  if (html) {
    lines.push(
      'Content-Type: multipart/alternative; boundary="b1"',
      "",
      "--b1",
      "Content-Type: text/plain; charset=utf-8",
      "",
      text,
      "--b1",
      "Content-Type: text/html; charset=utf-8",
      "",
      html,
      "--b1--",
    );
  } else {
    lines.push("Content-Type: text/plain; charset=utf-8", "", text);
  }

  return lines.join("\r\n");
}

function stringToStream(raw: string): Readable {
  const { Readable } = require("node:stream");
  const stream = new Readable();
  stream.push(Buffer.from(raw));
  stream.push(null);
  return stream;
}

const baseSession = {
  userId: "user-1",
  apiKeyId: "key-1",
  permission: "full_access",
  domain: null,
};

// ── Tests ─────────────────────────────────────────────────────────────

describe("relayMessage — MIME field mapping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindByUserAndEmails.mockResolvedValue([]);
    mockEmailRepoCreate.mockResolvedValue([{ id: "email-1" }]);
    mockPublishBackgroundJob.mockResolvedValue({
      status: "skipped",
      reason: "queue_url_missing",
    });
  });

  it("maps From/To/Subject/text from a plain-text message", async () => {
    const { relayMessage } = await import("../packages/smtp-relay/src/relay");

    const raw = makeRawMail({
      from: "alice@example.com",
      to: "bob@example.com",
      subject: "Hello Bob",
      text: "Hi there!",
    });

    await relayMessage(stringToStream(raw), baseSession);

    expect(mockEmailRepoCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "alice@example.com",
        to: ["bob@example.com"],
        subject: "Hello Bob",
        text: "Hi there!",
        userId: "user-1",
        status: "queued",
      }),
    );
  });

  it("maps HTML body alongside plain text", async () => {
    const { relayMessage } = await import("../packages/smtp-relay/src/relay");

    const raw = makeRawMail({
      from: "alice@example.com",
      to: "bob@example.com",
      subject: "Rich email",
      html: "<p>Rich content</p>",
      text: "Rich content",
    });

    await relayMessage(stringToStream(raw), baseSession);

    expect(mockEmailRepoCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        html: "<p>Rich content</p>",
        text: expect.stringContaining("Rich content"),
      }),
    );
  });

  it("maps Cc and Bcc headers", async () => {
    const { relayMessage } = await import("../packages/smtp-relay/src/relay");

    const raw = makeRawMail({
      from: "alice@example.com",
      to: "bob@example.com",
      cc: "cc@example.com",
      bcc: "bcc@example.com",
    });

    await relayMessage(stringToStream(raw), baseSession);

    expect(mockEmailRepoCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        cc: ["cc@example.com"],
        bcc: ["bcc@example.com"],
      }),
    );
  });

  it("publishes a background job with the email id after creating the row", async () => {
    const { relayMessage } = await import("../packages/smtp-relay/src/relay");

    const raw = makeRawMail({ from: "a@x.com", to: "b@x.com" });
    const result = await relayMessage(stringToStream(raw), baseSession);

    expect(result).toEqual({ id: "email-1" });
    expect(mockPublishBackgroundJob).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "email.send:email-1",
        type: "email.send",
        emailId: "email-1",
      }),
      expect.objectContaining({
        deduplicationId: "email.send:email-1",
        groupId: "email.send",
      }),
    );
  });
});

describe("relayMessage — suppression rejection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEmailRepoCreate.mockResolvedValue([{ id: "email-2" }]);
    mockPublishBackgroundJob.mockResolvedValue({
      status: "skipped",
      reason: "queue_url_missing",
    });
  });

  it("throws SmtpRelayError when a recipient is suppressed", async () => {
    mockFindByUserAndEmails.mockResolvedValue([
      { email: "suppressed@example.com", reason: "bounced" },
    ]);

    const { relayMessage, SmtpRelayError } = await import(
      "../packages/smtp-relay/src/relay"
    );

    const raw = makeRawMail({
      from: "a@x.com",
      to: "suppressed@example.com",
    });

    await expect(
      relayMessage(stringToStream(raw), baseSession),
    ).rejects.toBeInstanceOf(SmtpRelayError);

    // Email row must NOT be created
    expect(mockEmailRepoCreate).not.toHaveBeenCalled();
    // No job published
    expect(mockPublishBackgroundJob).not.toHaveBeenCalled();
  });
});

describe("relayMessage — domain restriction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindByUserAndEmails.mockResolvedValue([]);
    mockEmailRepoCreate.mockResolvedValue([{ id: "email-3" }]);
    mockPublishBackgroundJob.mockResolvedValue({
      status: "skipped",
      reason: "queue_url_missing",
    });
  });

  it("rejects when From domain does not match API key domain restriction", async () => {
    const { relayMessage, SmtpRelayError } = await import(
      "../packages/smtp-relay/src/relay"
    );

    const restrictedSession = {
      ...baseSession,
      domain: "allowed.com",
    };

    const raw = makeRawMail({
      from: "sender@other.com",
      to: "bob@example.com",
    });

    await expect(
      relayMessage(stringToStream(raw), restrictedSession),
    ).rejects.toBeInstanceOf(SmtpRelayError);

    expect(mockEmailRepoCreate).not.toHaveBeenCalled();
  });

  it("accepts when From domain matches API key domain restriction", async () => {
    const { relayMessage } = await import("../packages/smtp-relay/src/relay");

    const restrictedSession = {
      ...baseSession,
      domain: "allowed.com",
    };

    const raw = makeRawMail({
      from: "sender@allowed.com",
      to: "bob@example.com",
    });

    const result = await relayMessage(stringToStream(raw), restrictedSession);
    expect(result).toEqual({ id: "email-3" });
    expect(mockEmailRepoCreate).toHaveBeenCalled();
  });
});

describe("relayMessage — invalid MIME", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindByUserAndEmails.mockResolvedValue([]);
  });

  it("throws SmtpRelayError when From address is missing", async () => {
    const { relayMessage, SmtpRelayError } = await import(
      "../packages/smtp-relay/src/relay"
    );

    // Build a message without a From header
    const raw = [
      "To: bob@example.com",
      "Subject: No from",
      "Content-Type: text/plain",
      "",
      "body",
    ].join("\r\n");

    await expect(
      relayMessage(stringToStream(raw), baseSession),
    ).rejects.toBeInstanceOf(SmtpRelayError);
  });

  it("throws SmtpRelayError when To address is missing", async () => {
    const { relayMessage, SmtpRelayError } = await import(
      "../packages/smtp-relay/src/relay"
    );

    const raw = [
      "From: alice@example.com",
      "Subject: No to",
      "Content-Type: text/plain",
      "",
      "body",
    ].join("\r\n");

    await expect(
      relayMessage(stringToStream(raw), baseSession),
    ).rejects.toBeInstanceOf(SmtpRelayError);
  });
});
