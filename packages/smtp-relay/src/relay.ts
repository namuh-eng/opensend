import type { Readable } from "node:stream";
import {
  SuppressedRecipientError,
  createBackgroundJob,
  createTelemetryContext,
  emailRepo,
  logTelemetry,
  publishBackgroundJob,
  recordTelemetryError,
  suppressionRepo,
} from "@opensend/core";
import { type ParsedMail, simpleParser } from "mailparser";
import type { RelayAuthResult } from "./auth";

/** A rejection that should map to an SMTP 5xx response. */
export class SmtpRelayError extends Error {
  constructor(
    message: string,
    /** SMTP enhanced status code prefix, e.g. "550" or "552". */
    readonly smtpCode: number = 550,
  ) {
    super(message);
    this.name = "SmtpRelayError";
  }
}

type ParsedAttachment = {
  filename: string;
  content: string; // base64
  content_type?: string;
  content_id?: string;
};

function streamToBuffer(readable: Readable): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    readable.on("data", (chunk: Buffer | string) =>
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)),
    );
    readable.on("end", () => resolve(Buffer.concat(chunks)));
    readable.on("error", reject);
  });
}

function extractAddresses(
  field: ParsedMail["to"] | ParsedMail["cc"] | ParsedMail["bcc"],
): string[] {
  if (!field) return [];
  const addr = Array.isArray(field) ? field : [field];
  return addr.flatMap((a) =>
    a.value.map((v) => v.address).filter(Boolean),
  ) as string[];
}

function normalizeHeaders(
  headers: ParsedMail["headers"],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of headers.entries()) {
    // Skip headers that smtp-server / SES reconstructs from envelope/content
    const lower = key.toLowerCase();
    if (
      lower === "from" ||
      lower === "to" ||
      lower === "cc" ||
      lower === "bcc" ||
      lower === "subject" ||
      lower === "reply-to" ||
      lower === "content-type" ||
      lower === "mime-version" ||
      lower === "message-id" ||
      lower === "date"
    ) {
      continue;
    }
    const stringValue = Array.isArray(value)
      ? value.join(", ")
      : typeof value === "string"
        ? value
        : String(value);
    out[key] = stringValue;
  }
  return out;
}

async function buildAttachments(
  parsed: ParsedMail,
): Promise<ParsedAttachment[]> {
  const MAX_TOTAL_BASE64_BYTES = 40 * 1024 * 1024;
  const attachments: ParsedAttachment[] = [];
  let totalEncodedBytes = 0;

  for (const att of parsed.attachments ?? []) {
    const filename = att.filename ?? att.contentId ?? "attachment";
    const contentType = att.contentType ?? undefined;
    const contentId = att.contentId ?? undefined;

    // mailparser provides content as a Buffer
    const rawBytes = att.content.byteLength;
    const encodedSize = Math.ceil(rawBytes / 3) * 4;
    totalEncodedBytes += encodedSize;

    if (totalEncodedBytes > MAX_TOTAL_BASE64_BYTES) {
      throw new SmtpRelayError(
        "Message attachments exceed the 40 MB limit after Base64 encoding",
        552,
      );
    }

    const attachment: ParsedAttachment = {
      filename,
      content: att.content.toString("base64"),
      ...(contentType ? { content_type: contentType } : {}),
      ...(contentId ? { content_id: contentId } : {}),
    };
    attachments.push(attachment);
  }

  return attachments;
}

/**
 * Parse the raw MIME stream, validate recipients against suppressions, check
 * sending domain against the api key domain restriction, create a DB row, and
 * enqueue the send job — exactly the same path the REST API uses.
 */
export async function relayMessage(
  rawStream: Readable,
  session: RelayAuthResult,
): Promise<{ id: string }> {
  const telemetry = createTelemetryContext({
    service: "smtp-relay",
    operation: "relay.message",
  });

  // ── 1. Parse MIME ──────────────────────────────────────────────
  let parsed: ParsedMail;
  try {
    parsed = await simpleParser(rawStream);
  } catch (error) {
    recordTelemetryError(telemetry, "smtp_relay.parse_failed", error);
    throw new SmtpRelayError("Failed to parse MIME message", 500);
  }

  // ── 2. Extract envelope fields ─────────────────────────────────
  const fromAddresses = extractAddresses(parsed.from);
  const from = fromAddresses[0];
  if (!from) {
    throw new SmtpRelayError("Message has no From address", 550);
  }

  const to = extractAddresses(parsed.to);
  if (to.length === 0) {
    throw new SmtpRelayError("Message has no To address", 550);
  }

  const cc = extractAddresses(parsed.cc);
  const bcc = extractAddresses(parsed.bcc);
  const replyTo = extractAddresses(parsed.replyTo);
  const subject = parsed.subject ?? "";
  const html = parsed.html || "";
  const text = parsed.text ?? "";
  const headers = normalizeHeaders(parsed.headers);

  // ── 3. Domain restriction check ────────────────────────────────
  if (session.domain) {
    const fromDomain = from.split("@")[1]?.toLowerCase();
    if (!fromDomain || fromDomain !== session.domain.toLowerCase()) {
      throw new SmtpRelayError(
        `API key is restricted to domain ${session.domain}; From domain ${fromDomain ?? "(none)"} is not allowed`,
        550,
      );
    }
  }

  // ── 4. Suppression check ───────────────────────────────────────
  try {
    const suppressed = await suppressionRepo.findByUserAndEmails(
      session.userId,
      to,
    );
    if (suppressed.length > 0) {
      const first = suppressed[0];
      throw new SuppressedRecipientError(
        suppressed.map((s) => ({ email: s.email, reason: s.reason })),
      );
    }
  } catch (error) {
    if (error instanceof SuppressedRecipientError) {
      throw new SmtpRelayError(error.message, 550);
    }
    recordTelemetryError(
      telemetry,
      "smtp_relay.suppression_check_failed",
      error,
    );
    throw new SmtpRelayError("Internal error checking suppressions", 500);
  }

  // ── 5. Build attachments ───────────────────────────────────────
  let attachments: ParsedAttachment[];
  try {
    attachments = await buildAttachments(parsed);
  } catch (error) {
    if (error instanceof SmtpRelayError) throw error;
    recordTelemetryError(telemetry, "smtp_relay.attachment_failed", error);
    throw new SmtpRelayError("Failed to process attachments", 500);
  }

  // ── 6. Persist email row ───────────────────────────────────────
  let emailId: string;
  try {
    const [record] = await emailRepo.create({
      from,
      to,
      cc: cc.length > 0 ? cc : [],
      bcc: bcc.length > 0 ? bcc : [],
      replyTo: replyTo.length > 0 ? replyTo : [],
      subject,
      html,
      text,
      headers,
      attachments,
      tags: [],
      status: "queued",
      scheduledAt: null,
      topicId: null,
      idempotencyKey: null,
      userId: session.userId,
    });
    emailId = record.id;
  } catch (error) {
    recordTelemetryError(telemetry, "smtp_relay.db_create_failed", error);
    throw new SmtpRelayError("Failed to store message", 500);
  }

  // ── 7. Enqueue send job ────────────────────────────────────────
  try {
    await publishBackgroundJob(
      createBackgroundJob({
        id: `email.send:${emailId}`,
        type: "email.send",
        source: "api",
        emailId,
      }),
      {
        deduplicationId: `email.send:${emailId}`,
        groupId: "email.send",
      },
    );
  } catch (error) {
    // Mark the email as failed so the DB row doesn't linger in "queued" forever
    await emailRepo
      .update(
        emailId,
        {
          status: "failed",
          providerLastAttemptedAt: new Date(),
          providerLastErrorCode: "queue_publish_failed",
          providerLastErrorMessage:
            error instanceof Error ? error.message : "Queue publish failed",
          providerNextRetryAt: null,
          providerDeadLetteredAt: new Date(),
        },
        session.userId,
      )
      .catch(() => {
        // best-effort; if this also fails just log
      });
    recordTelemetryError(telemetry, "smtp_relay.enqueue_failed", error);
    throw new SmtpRelayError("Failed to enqueue message for delivery", 500);
  }

  logTelemetry("info", "smtp_relay.message_accepted", telemetry, {
    email_id: emailId,
    from,
    recipient_count: to.length,
    user_id: session.userId,
  });

  return { id: emailId };
}
