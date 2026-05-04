import { createPublicKey, createVerify } from "node:crypto";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type SnsMessageType =
  | "Notification"
  | "SubscriptionConfirmation"
  | "UnsubscribeConfirmation";

type SesHeader = {
  name: string;
  value: string;
};

type SesMail = {
  messageId: string;
  headers?: SesHeader[];
  tags?: Record<string, string[]>;
};

export type SesNotification = {
  eventType: string;
  mail: SesMail;
  [key: string]: unknown;
};

export type SnsEnvelope = {
  Type: SnsMessageType;
  MessageId: string;
  TopicArn: string;
  Message: string;
  Timestamp: string;
  SignatureVersion: string;
  Signature: string;
  SigningCertURL: string;
  Subject?: string;
  SubscribeURL?: string;
  Token?: string;
};

export class SnsValidationError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "SnsValidationError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(record: Record<string, unknown>, key: string): string {
  const value = record[key];

  if (typeof value === "string" && value.length > 0) {
    return value;
  }

  throw new SnsValidationError(`SNS payload is missing ${key}`, 400);
}

function readOptionalString(record: Record<string, unknown>, key: string) {
  const value = record[key];

  if (value === undefined) {
    return undefined;
  }

  if (typeof value === "string" && value.length > 0) {
    return value;
  }

  throw new SnsValidationError(`SNS payload has invalid ${key}`, 400);
}

function normalizeSnsType(type: string): SnsMessageType {
  if (
    type === "Notification" ||
    type === "SubscriptionConfirmation" ||
    type === "UnsubscribeConfirmation"
  ) {
    return type;
  }

  throw new SnsValidationError(`Unsupported SNS message type ${type}`, 400);
}

function buildStringToSign(message: SnsEnvelope) {
  const fields =
    message.Type === "Notification"
      ? ["Message", "MessageId", "Subject", "Timestamp", "TopicArn", "Type"]
      : [
          "Message",
          "MessageId",
          "SubscribeURL",
          "Timestamp",
          "Token",
          "TopicArn",
          "Type",
        ];

  const lines: string[] = [];

  for (const field of fields) {
    const value = message[field as keyof SnsEnvelope];

    if (typeof value !== "string" || value.length === 0) {
      if (field === "Subject" && message.Type === "Notification") {
        continue;
      }

      throw new SnsValidationError(
        `SNS payload is missing ${field} required for signature verification`,
        400,
      );
    }

    lines.push(field, value);
  }

  return `${lines.join("\n")}\n`;
}

function assertTrustedSigningCertUrl(signingCertUrl: string) {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(signingCertUrl);
  } catch {
    throw new SnsValidationError("SNS SigningCertURL is invalid", 400);
  }

  if (parsedUrl.protocol !== "https:") {
    throw new SnsValidationError("SNS SigningCertURL must use HTTPS", 400);
  }

  if (!/^sns\.[a-z0-9-]+\.amazonaws\.com(\.cn)?$/i.test(parsedUrl.hostname)) {
    throw new SnsValidationError(
      "SNS SigningCertURL must point to an AWS SNS host",
      400,
    );
  }

  if (!parsedUrl.pathname.endsWith(".pem")) {
    throw new SnsValidationError(
      "SNS SigningCertURL must reference a PEM certificate",
      400,
    );
  }
}

export function parseSnsEnvelope(
  body: unknown,
  headerType?: string,
): SnsEnvelope {
  if (!isRecord(body)) {
    throw new SnsValidationError("SNS payload must be a JSON object", 400);
  }

  const Type = normalizeSnsType(readString(body, "Type"));

  if (headerType && headerType !== Type) {
    throw new SnsValidationError(
      `SNS header type ${headerType} does not match body type ${Type}`,
      400,
    );
  }

  return {
    Type,
    MessageId: readString(body, "MessageId"),
    TopicArn: readString(body, "TopicArn"),
    Message: readString(body, "Message"),
    Timestamp: readString(body, "Timestamp"),
    SignatureVersion: readString(body, "SignatureVersion"),
    Signature: readString(body, "Signature"),
    SigningCertURL: readString(body, "SigningCertURL"),
    Subject: readOptionalString(body, "Subject"),
    SubscribeURL: readOptionalString(body, "SubscribeURL"),
    Token: readOptionalString(body, "Token"),
  };
}

export async function verifySnsSignature(message: SnsEnvelope) {
  assertTrustedSigningCertUrl(message.SigningCertURL);

  const algorithm =
    message.SignatureVersion === "1"
      ? "RSA-SHA1"
      : message.SignatureVersion === "2"
        ? "RSA-SHA256"
        : null;

  if (!algorithm) {
    throw new SnsValidationError(
      `Unsupported SNS signature version ${message.SignatureVersion}`,
      400,
    );
  }

  const certificateResponse = await fetch(message.SigningCertURL);

  if (!certificateResponse.ok) {
    throw new SnsValidationError(
      `Unable to fetch SNS signing certificate (${certificateResponse.status})`,
      401,
    );
  }

  const certificatePem = await certificateResponse.text();
  const verifier = createVerify(algorithm);
  verifier.update(buildStringToSign(message), "utf8");
  verifier.end();

  const isValid = verifier.verify(
    createPublicKey(certificatePem),
    Buffer.from(message.Signature, "base64"),
  );

  if (!isValid) {
    throw new SnsValidationError("SNS signature verification failed", 401);
  }
}

export function parseSesNotification(rawMessage: string): SesNotification {
  let parsed: unknown;

  try {
    parsed = JSON.parse(rawMessage);
  } catch {
    throw new SnsValidationError("SNS Message must be valid JSON", 400);
  }

  if (!isRecord(parsed)) {
    throw new SnsValidationError(
      "SES notification payload must be an object",
      400,
    );
  }

  const eventType = readString(parsed, "eventType");
  const mail = parsed.mail;

  if (!isRecord(mail)) {
    throw new SnsValidationError("SES notification is missing mail", 400);
  }

  const messageId = readString(mail, "messageId");
  const headers = mail.headers;

  if (
    headers !== undefined &&
    (!Array.isArray(headers) ||
      headers.some(
        (header) =>
          !isRecord(header) ||
          typeof header.name !== "string" ||
          typeof header.value !== "string",
      ))
  ) {
    throw new SnsValidationError(
      "SES mail.headers must be an array of headers",
      400,
    );
  }

  const tags = mail.tags;

  if (
    tags !== undefined &&
    (!isRecord(tags) ||
      Object.values(tags).some(
        (value) =>
          !Array.isArray(value) ||
          value.some((entry) => typeof entry !== "string"),
      ))
  ) {
    throw new SnsValidationError(
      "SES mail.tags must be a string array map",
      400,
    );
  }

  return {
    ...parsed,
    eventType,
    mail: {
      messageId,
      headers: headers as SesHeader[] | undefined,
      tags: tags as Record<string, string[]> | undefined,
    },
  };
}

export function extractEmailId(notification: SesNotification) {
  const headerValue = notification.mail.headers?.find(
    (header) => header.name.toLowerCase() === "x-entity-id",
  )?.value;

  const tagValue = notification.mail.tags?.["X-Entity-ID"]?.[0];
  const candidate = headerValue ?? tagValue;

  if (!candidate || !UUID_REGEX.test(candidate)) {
    return null;
  }

  return candidate;
}
