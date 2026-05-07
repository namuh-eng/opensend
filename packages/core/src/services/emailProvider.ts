import {
  CreateEmailIdentityCommand,
  DeleteEmailIdentityCommand,
  GetEmailIdentityCommand,
  SESv2Client,
  SendEmailCommand,
} from "@aws-sdk/client-sesv2";

type EmailAttachment = {
  filename: string;
  content: string;
  contentType?: string;
  contentId?: string;
  content_type?: string;
  content_id?: string;
};

export class EmailProviderService {
  private client: SESv2Client | null = null;

  private getClient() {
    if (this.client) return this.client;
    this.client = new SESv2Client({
      region: process.env.AWS_REGION ?? "us-east-1",
    });
    return this.client;
  }

  async sendEmail(params: {
    from: string;
    to: string[];
    subject: string;
    html?: string;
    text?: string;
    cc?: string[];
    bcc?: string[];
    replyTo?: string[];
    headers?: Record<string, string>;
    attachments?: EmailAttachment[];
  }) {
    const command =
      params.attachments && params.attachments.length > 0
        ? new SendEmailCommand({
            FromEmailAddress: params.from,
            Destination: {
              ToAddresses: params.to,
              CcAddresses: params.cc,
              BccAddresses: params.bcc,
            },
            Content: {
              Raw: {
                Data: new TextEncoder().encode(buildMimeMessage(params)),
              },
            },
          })
        : new SendEmailCommand({
            FromEmailAddress: params.from,
            Destination: {
              ToAddresses: params.to,
              CcAddresses: params.cc,
              BccAddresses: params.bcc,
            },
            Content: {
              Simple: {
                Subject: { Data: params.subject },
                Body: {
                  Html: params.html ? { Data: params.html } : undefined,
                  Text: params.text ? { Data: params.text } : undefined,
                },
              },
            },
            ReplyToAddresses: params.replyTo,
          });

    if (!process.env.AWS_ACCESS_KEY_ID) {
      console.log(
        `[DEV] SES send skipped: ${params.subject} to ${params.to.join(", ")}`,
      );
      return { id: `dev-${Date.now()}` };
    }

    const res = await this.getClient().send(command);
    return { id: res.MessageId };
  }

  async getDomainIdentity(domain: string) {
    if (!process.env.AWS_ACCESS_KEY_ID)
      return { verified: true, dkimTokens: ["dev1", "dev2", "dev3"] };
    const res = await this.getClient().send(
      new GetEmailIdentityCommand({ EmailIdentity: domain }),
    );
    return {
      verified: res.VerifiedForSendingStatus,
      dkimTokens: res.DkimAttributes?.Tokens,
    };
  }

  async deleteDomainIdentity(domain: string) {
    if (!process.env.AWS_ACCESS_KEY_ID) return;
    await this.getClient().send(
      new DeleteEmailIdentityCommand({ EmailIdentity: domain }),
    );
  }

  async createDomainIdentity(domain: string) {
    if (!process.env.AWS_ACCESS_KEY_ID)
      return { dkimTokens: ["dev1", "dev2", "dev3"] };
    const res = await this.getClient().send(
      new CreateEmailIdentityCommand({ EmailIdentity: domain }),
    );
    return { dkimTokens: res.DkimAttributes?.Tokens };
  }
}

export const emailProvider = new EmailProviderService();

function buildMimeMessage(params: {
  from: string;
  to: string[];
  subject: string;
  html?: string;
  text?: string;
  cc?: string[];
  bcc?: string[];
  replyTo?: string[];
  headers?: Record<string, string>;
  attachments?: EmailAttachment[];
}): string {
  const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const lines: string[] = [];

  lines.push(`From: ${params.from}`);
  lines.push(`To: ${params.to.join(", ")}`);
  if (params.cc?.length) lines.push(`Cc: ${params.cc.join(", ")}`);
  if (params.bcc?.length) lines.push(`Bcc: ${params.bcc.join(", ")}`);
  lines.push(`Subject: ${params.subject}`);
  if (params.replyTo?.length)
    lines.push(`Reply-To: ${params.replyTo.join(", ")}`);
  if (params.headers) {
    for (const [key, value] of Object.entries(params.headers)) {
      lines.push(`${key}: ${value}`);
    }
  }
  lines.push("MIME-Version: 1.0");
  lines.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
  lines.push("");

  lines.push(`--${boundary}`);
  if (params.html) {
    lines.push("Content-Type: text/html; charset=UTF-8");
    lines.push("Content-Transfer-Encoding: 7bit");
    lines.push("");
    lines.push(params.html);
  } else if (params.text) {
    lines.push("Content-Type: text/plain; charset=UTF-8");
    lines.push("Content-Transfer-Encoding: 7bit");
    lines.push("");
    lines.push(params.text);
  }

  for (const attachment of params.attachments ?? []) {
    const contentType =
      attachment.contentType ??
      attachment.content_type ??
      inferContentType(attachment.filename);
    const contentId = attachment.contentId ?? attachment.content_id;

    lines.push(`--${boundary}`);
    lines.push(`Content-Type: ${contentType}; name="${attachment.filename}"`);
    lines.push("Content-Transfer-Encoding: base64");
    if (contentId) {
      lines.push(`Content-ID: ${formatContentId(contentId)}`);
    }
    lines.push(
      `Content-Disposition: ${contentId ? "inline" : "attachment"}; filename="${attachment.filename}"`,
    );
    lines.push("");
    lines.push(attachment.content);
  }

  lines.push(`--${boundary}--`);
  return lines.join("\r\n");
}

function inferContentType(filename: string): string {
  const extension = filename.toLowerCase().split(".").pop();
  switch (extension) {
    case "txt":
      return "text/plain";
    case "html":
    case "htm":
      return "text/html";
    case "json":
      return "application/json";
    case "csv":
      return "text/csv";
    case "pdf":
      return "application/pdf";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "gif":
      return "image/gif";
    case "svg":
      return "image/svg+xml";
    case "webp":
      return "image/webp";
    default:
      return "application/octet-stream";
  }
}

function formatContentId(contentId: string): string {
  const trimmed = contentId.trim();
  if (trimmed.startsWith("<") && trimmed.endsWith(">")) return trimmed;
  return `<${trimmed}>`;
}
