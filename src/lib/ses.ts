import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  CreateEmailIdentityCommand,
  DeleteEmailIdentityCommand,
  GetEmailIdentityCommand,
  SESv2Client,
  SendEmailCommand,
} from "@aws-sdk/client-sesv2";

// ── Local Dev Detection ───────────────────────────────────────────
// Stub SES only in development mode with no creds. In test, we want the
// mocked client to be exercised; in production, a missing credential should
// surface loudly rather than silently "succeed".

const hasAwsCredentials =
  !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) ||
  !!process.env.AWS_PROFILE ||
  existsSync(join(process.env.HOME ?? "", ".aws", "credentials"));

const useDevStub = process.env.NODE_ENV === "development" && !hasAwsCredentials;

if (useDevStub) {
  console.log(
    "[opensend] AWS credentials not found — emails will be logged to console instead of sent via SES.",
  );
}

// ── Types ──────────────────────────────────────────────────────────

export interface SendEmailInput {
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string[];
  headers?: Record<string, string>;
  attachments?: Array<{ filename: string; content: string }>;
}

export interface SendEmailResult {
  id: string;
}

export interface CreateDomainResult {
  dkimTokens: string[];
  status: string;
}

export interface GetDomainResult {
  verified: boolean;
  dkimStatus: string;
  dkimTokens: string[];
}

// ── Client ─────────────────────────────────────────────────────────

const ses = new SESv2Client({ region: process.env.AWS_REGION ?? "us-east-1" });

// ── Email Sending ──────────────────────────────────────────────────

export async function sendEmail(
  input: SendEmailInput,
): Promise<SendEmailResult> {
  if (!input.from) throw new Error("from is required");
  if (!input.to || input.to.length === 0) throw new Error("to is required");
  if (!input.subject) throw new Error("subject is required");
  if (!input.html && !input.text)
    throw new Error("html or text body is required");

  // Local dev fallback — log to console instead of sending
  if (useDevStub) {
    const devId = `dev_${Date.now()}`;
    console.log("\n┌─ [DEV] Email (not sent — no AWS credentials) ─────────");
    console.log(`│ ID:      ${devId}`);
    console.log(`│ From:    ${input.from}`);
    console.log(`│ To:      ${input.to.join(", ")}`);
    if (input.cc?.length) console.log(`│ CC:      ${input.cc.join(", ")}`);
    if (input.bcc?.length) console.log(`│ BCC:     ${input.bcc.join(", ")}`);
    console.log(`│ Subject: ${input.subject}`);
    console.log("└────────────────────────────────────────────────────────\n");
    return { id: devId };
  }

  // Build raw MIME message if attachments present
  if (input.attachments && input.attachments.length > 0) {
    const rawMessage = buildMimeMessage(input);
    const command = new SendEmailCommand({
      FromEmailAddress: input.from,
      Destination: {
        ToAddresses: input.to,
        CcAddresses: input.cc,
        BccAddresses: input.bcc,
      },
      Content: {
        Raw: {
          Data: new TextEncoder().encode(rawMessage),
        },
      },
    });
    const response = await ses.send(command);
    return { id: response.MessageId ?? "" };
  }

  // Simple email (no attachments)
  const command = new SendEmailCommand({
    FromEmailAddress: input.from,
    Destination: {
      ToAddresses: input.to,
      CcAddresses: input.cc,
      BccAddresses: input.bcc,
    },
    ReplyToAddresses: input.replyTo,
    Content: {
      Simple: {
        Subject: { Data: input.subject, Charset: "UTF-8" },
        Body: {
          ...(input.html
            ? { Html: { Data: input.html, Charset: "UTF-8" } }
            : {}),
          ...(input.text
            ? { Text: { Data: input.text, Charset: "UTF-8" } }
            : {}),
        },
        Headers: input.headers
          ? Object.entries(input.headers).map(([Name, Value]) => ({
              Name,
              Value,
            }))
          : undefined,
      },
    },
  });

  const response = await ses.send(command);
  return { id: response.MessageId ?? "" };
}

// ── Domain Identity Management ─────────────────────────────────────

export async function createDomainIdentity(
  domain: string,
): Promise<CreateDomainResult> {
  if (!domain) throw new Error("domain is required");

  if (useDevStub) {
    console.log(`[DEV] Would create SES identity for domain: ${domain}`);
    return {
      dkimTokens: ["dev-token-1", "dev-token-2", "dev-token-3"],
      status: "PENDING",
    };
  }

  const command = new CreateEmailIdentityCommand({
    EmailIdentity: domain,
  });

  const response = await ses.send(command);

  return {
    dkimTokens: response.DkimAttributes?.Tokens ?? [],
    status: response.DkimAttributes?.Status ?? "PENDING",
  };
}

export async function getDomainIdentity(
  domain: string,
): Promise<GetDomainResult> {
  if (!domain) throw new Error("domain is required");

  if (useDevStub) {
    return { verified: false, dkimStatus: "NOT_STARTED", dkimTokens: [] };
  }

  const command = new GetEmailIdentityCommand({
    EmailIdentity: domain,
  });

  const response = await ses.send(command);

  return {
    verified: response.VerifiedForSendingStatus ?? false,
    dkimStatus: response.DkimAttributes?.Status ?? "NOT_STARTED",
    dkimTokens: response.DkimAttributes?.Tokens ?? [],
  };
}

export async function deleteDomainIdentity(domain: string): Promise<void> {
  if (!domain) throw new Error("domain is required");

  if (useDevStub) {
    console.log(`[DEV] Would delete SES identity for domain: ${domain}`);
    return;
  }

  const command = new DeleteEmailIdentityCommand({
    EmailIdentity: domain,
  });

  await ses.send(command);
}

// ── MIME Builder (for attachments) ─────────────────────────────────

function buildMimeMessage(input: SendEmailInput): string {
  const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const lines: string[] = [];

  lines.push(`From: ${input.from}`);
  lines.push(`To: ${input.to.join(", ")}`);
  if (input.cc?.length) lines.push(`Cc: ${input.cc.join(", ")}`);
  if (input.bcc?.length) lines.push(`Bcc: ${input.bcc.join(", ")}`);
  lines.push(`Subject: ${input.subject}`);
  if (input.replyTo?.length)
    lines.push(`Reply-To: ${input.replyTo.join(", ")}`);
  if (input.headers) {
    for (const [key, value] of Object.entries(input.headers)) {
      lines.push(`${key}: ${value}`);
    }
  }
  lines.push("MIME-Version: 1.0");
  lines.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
  lines.push("");

  // Body part
  lines.push(`--${boundary}`);
  if (input.html) {
    lines.push("Content-Type: text/html; charset=UTF-8");
    lines.push("Content-Transfer-Encoding: 7bit");
    lines.push("");
    lines.push(input.html);
  } else if (input.text) {
    lines.push("Content-Type: text/plain; charset=UTF-8");
    lines.push("Content-Transfer-Encoding: 7bit");
    lines.push("");
    lines.push(input.text);
  }

  // Attachments
  for (const attachment of input.attachments ?? []) {
    lines.push(`--${boundary}`);
    lines.push(
      `Content-Type: application/octet-stream; name="${attachment.filename}"`,
    );
    lines.push("Content-Transfer-Encoding: base64");
    lines.push(
      `Content-Disposition: attachment; filename="${attachment.filename}"`,
    );
    lines.push("");
    lines.push(attachment.content);
  }

  lines.push(`--${boundary}--`);
  return lines.join("\r\n");
}
