import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  CreateEmailIdentityCommand,
  DeleteEmailIdentityCommand,
  GetEmailIdentityCommand,
  PutEmailIdentityDkimSigningAttributesCommand,
  SESv2Client,
  SendEmailCommand,
} from "@aws-sdk/client-sesv2";
import {
  type EncryptedBlob,
  decryptSecret,
  generateDkimKeypair,
} from "./dkim-keys";

type EmailAttachment = {
  filename: string;
  content: string;
  contentType?: string;
  contentId?: string;
  content_type?: string;
  content_id?: string;
};

type EmailProviderCreateDomainIdentityOptions = {
  userId?: string;
  region?: string;
};

type EmailProviderCreateDomainIdentityResult = {
  dkimOrigin: "AWS_SES" | "EXTERNAL";
  status: string;
  dkimSelector?: string;
  dkimPublicKey?: string;
  dkimPrivateKeyEnc?: EncryptedBlob;
  dkimTokens?: string[];
};

type EmailProviderGetDomainIdentityResult = {
  verified: boolean;
  dkimStatus: string;
  dkimTokens: string[];
};

const hasAwsCredentials =
  !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) ||
  !!process.env.AWS_PROFILE ||
  existsSync(join(process.env.HOME ?? "", ".aws", "credentials"));

const useDevStub = process.env.NODE_ENV === "development" && !hasAwsCredentials;

const DEFAULT_SES_REGION = "us-east-1";

function normalizeSesRegion(region: string | null | undefined): string {
  const trimmed = region?.trim();
  return trimmed || DEFAULT_SES_REGION;
}

export class EmailProviderService {
  private readonly clients = new Map<string, SESv2Client>();

  private getClient(region?: string | null) {
    const resolvedRegion = normalizeSesRegion(region);
    const cached = this.clients.get(resolvedRegion);
    if (cached) return cached;

    const client = new SESv2Client({ region: resolvedRegion });
    this.clients.set(resolvedRegion, client);
    return client;
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
    region?: string;
    configurationSetName?: string | null;
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
            ...(params.configurationSetName
              ? { ConfigurationSetName: params.configurationSetName }
              : {}),
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
            ...(params.configurationSetName
              ? { ConfigurationSetName: params.configurationSetName }
              : {}),
          });

    if (useDevStub) {
      console.log(
        `[DEV] SES send skipped in ${normalizeSesRegion(params.region)}: ${params.subject} to ${params.to.join(", ")}`,
      );
      return { id: `dev-${Date.now()}` };
    }

    const res = await this.getClient(params.region).send(command);
    return { id: res.MessageId };
  }

  async getDomainIdentity(
    domain: string,
    options: { region?: string } = {},
  ): Promise<EmailProviderGetDomainIdentityResult> {
    if (!domain) throw new Error("domain is required");

    if (useDevStub) {
      return { verified: false, dkimStatus: "NOT_STARTED", dkimTokens: [] };
    }

    const res = await this.getClient(options.region).send(
      new GetEmailIdentityCommand({ EmailIdentity: domain }),
    );

    return {
      verified: res.VerifiedForSendingStatus ?? false,
      dkimStatus: res.DkimAttributes?.Status ?? "NOT_STARTED",
      dkimTokens: res.DkimAttributes?.Tokens ?? [],
    };
  }

  async deleteDomainIdentity(
    domain: string,
    options: { region?: string } = {},
  ): Promise<void> {
    if (!domain) throw new Error("domain is required");

    if (useDevStub) {
      console.log(
        `[DEV] Would delete SES identity for domain: ${domain} in ${normalizeSesRegion(options.region)}`,
      );
      return;
    }

    await this.getClient(options.region).send(
      new DeleteEmailIdentityCommand({ EmailIdentity: domain }),
    );
  }

  async createDomainIdentity(
    domain: string,
    options: EmailProviderCreateDomainIdentityOptions = {},
  ): Promise<EmailProviderCreateDomainIdentityResult> {
    if (!domain) throw new Error("domain is required");

    if (options.userId) {
      return this.createExternalDkimIdentity(
        domain,
        options.userId,
        options.region,
      );
    }

    return this.createSesManagedIdentity(domain, options.region);
  }

  private async createExternalDkimIdentity(
    domain: string,
    userId: string,
    region?: string,
  ): Promise<EmailProviderCreateDomainIdentityResult> {
    const keypair = generateDkimKeypair(userId);

    if (useDevStub) {
      console.log(
        `[DEV] Would create SES EXTERNAL identity for ${domain} in ${normalizeSesRegion(region)} (selector ${keypair.selector})`,
      );
      return {
        dkimOrigin: "EXTERNAL",
        status: "PENDING",
        dkimSelector: keypair.selector,
        dkimPublicKey: keypair.publicKeyDnsValue,
        dkimPrivateKeyEnc: keypair.privateKeyPemEncrypted,
      };
    }

    const privateKeyPem = decryptSecret(keypair.privateKeyPemEncrypted);
    const signingAttributes = {
      DomainSigningSelector: keypair.selector,
      DomainSigningPrivateKey: pemToBase64Body(privateKeyPem),
    };
    const client = this.getClient(region);

    try {
      const res = await client.send(
        new CreateEmailIdentityCommand({
          EmailIdentity: domain,
          DkimSigningAttributes: signingAttributes,
        }),
      );
      return {
        dkimOrigin: "EXTERNAL",
        status: res.DkimAttributes?.Status ?? "PENDING",
        dkimSelector: keypair.selector,
        dkimPublicKey: keypair.publicKeyDnsValue,
        dkimPrivateKeyEnc: keypair.privateKeyPemEncrypted,
      };
    } catch (error) {
      if (!isAlreadyExistsError(error)) throw error;
      await client.send(
        new PutEmailIdentityDkimSigningAttributesCommand({
          EmailIdentity: domain,
          SigningAttributesOrigin: "EXTERNAL",
          SigningAttributes: signingAttributes,
        }),
      );
      return {
        dkimOrigin: "EXTERNAL",
        status: "PENDING",
        dkimSelector: keypair.selector,
        dkimPublicKey: keypair.publicKeyDnsValue,
        dkimPrivateKeyEnc: keypair.privateKeyPemEncrypted,
      };
    }
  }

  private async createSesManagedIdentity(
    domain: string,
    region?: string,
  ): Promise<EmailProviderCreateDomainIdentityResult> {
    if (useDevStub) {
      console.log(
        `[DEV] Would create SES identity for domain: ${domain} in ${normalizeSesRegion(region)}`,
      );
      return {
        dkimOrigin: "AWS_SES",
        dkimTokens: ["dev-token-1", "dev-token-2", "dev-token-3"],
        status: "PENDING",
      };
    }
    const client = this.getClient(region);

    try {
      const res = await client.send(
        new CreateEmailIdentityCommand({ EmailIdentity: domain }),
      );
      return {
        dkimOrigin: "AWS_SES",
        dkimTokens: res.DkimAttributes?.Tokens ?? [],
        status: res.DkimAttributes?.Status ?? "PENDING",
      };
    } catch (error) {
      if (!isAlreadyExistsError(error)) throw error;
      const res = await client.send(
        new GetEmailIdentityCommand({ EmailIdentity: domain }),
      );
      return {
        dkimOrigin: "AWS_SES",
        dkimTokens: res.DkimAttributes?.Tokens ?? [],
        status: res.DkimAttributes?.Status ?? "PENDING",
      };
    }
  }
}

function pemToBase64Body(pem: string): string {
  return pem
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/\s+/g, "");
}

function isAlreadyExistsError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error as { name: string }).name === "AlreadyExistsException"
  );
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
