export type EmailEventTraceDetailValue = string | number | boolean | string[];

export type EmailEventTraceDetails = Record<string, EmailEventTraceDetailValue>;

export type EmailEventTraceRow = {
  id: string;
  type: string;
  payload: unknown;
  receivedAt: Date;
};

export type EmailEventTraceItem = {
  object: "email_event";
  id: string;
  type: string;
  created_at: Date;
  summary: string;
  details: EmailEventTraceDetails;
};

const MAX_STRING_LENGTH = 180;
const MAX_RECIPIENTS = 3;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readRecord(
  source: Record<string, unknown>,
  key: string,
): Record<string, unknown> | null {
  const value = source[key];
  return isRecord(value) ? value : null;
}

function truncate(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length <= MAX_STRING_LENGTH) return trimmed;
  return `${trimmed.slice(0, MAX_STRING_LENGTH - 1)}…`;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? truncate(value) : null;
}

function readNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function firstString(
  sources: Array<Record<string, unknown> | null>,
  keys: readonly string[],
): string | null {
  for (const source of sources) {
    if (!source) continue;
    for (const key of keys) {
      const value = readString(source[key]);
      if (value) return value;
    }
  }
  return null;
}

function firstNumber(
  sources: Array<Record<string, unknown> | null>,
  keys: readonly string[],
): number | null {
  for (const source of sources) {
    if (!source) continue;
    for (const key of keys) {
      const value = readNumber(source[key]);
      if (value !== null) return value;
    }
  }
  return null;
}

function firstBoolean(
  sources: Array<Record<string, unknown> | null>,
  keys: readonly string[],
): boolean | null {
  for (const source of sources) {
    if (!source) continue;
    for (const key of keys) {
      const value = readBoolean(source[key]);
      if (value !== null) return value;
    }
  }
  return null;
}

function addString(
  details: EmailEventTraceDetails,
  key: string,
  value: string | null,
) {
  if (value) details[key] = value;
}

function addNumber(
  details: EmailEventTraceDetails,
  key: string,
  value: number | null,
) {
  if (value !== null) details[key] = value;
}

function addBoolean(
  details: EmailEventTraceDetails,
  key: string,
  value: boolean | null,
) {
  if (value !== null) details[key] = value;
}

function readRecipientAddress(value: unknown): string | null {
  if (typeof value === "string") return readString(value);
  if (!isRecord(value)) return null;
  return firstString([value], ["emailAddress", "email_address", "email"]);
}

function readRecipientRecords(
  source: Record<string, unknown>,
  key: string,
): Record<string, unknown>[] {
  const value = source[key];
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord);
}

function readRecipientStrings(
  source: Record<string, unknown>,
  key: string,
): string[] {
  const value = source[key];
  if (!Array.isArray(value)) return [];
  return value
    .map(readRecipientAddress)
    .filter((recipient): recipient is string => Boolean(recipient));
}

function extractRecipients(
  payload: Record<string, unknown>,
  mail: Record<string, unknown> | null,
): {
  recipients: string[];
  total: number;
  firstRecord: Record<string, unknown> | null;
} {
  const recipientRecords = [
    ...readRecipientRecords(payload, "bouncedRecipients"),
    ...readRecipientRecords(payload, "complainedRecipients"),
  ];

  const recipients = [
    ...readRecipientStrings(payload, "recipients"),
    ...readRecipientStrings(payload, "bouncedRecipients"),
    ...readRecipientStrings(payload, "complainedRecipients"),
    ...(mail ? readRecipientStrings(mail, "destination") : []),
  ];

  const uniqueRecipients = Array.from(new Set(recipients));
  return {
    recipients: uniqueRecipients.slice(0, MAX_RECIPIENTS),
    total: uniqueRecipients.length,
    firstRecord: recipientRecords[0] ?? null,
  };
}

function addRecipients(
  details: EmailEventTraceDetails,
  extracted: ReturnType<typeof extractRecipients>,
) {
  if (extracted.recipients.length > 0) {
    details.recipients = extracted.recipients;
  }
  if (extracted.total > extracted.recipients.length) {
    details.recipients_count = extracted.total;
  }
}

function stringDetail(
  details: EmailEventTraceDetails,
  key: string,
): string | null {
  const value = details[key];
  return typeof value === "string" ? value : null;
}

function recipientsDetail(details: EmailEventTraceDetails): string | null {
  const value = details.recipients;
  if (!Array.isArray(value) || value.length === 0) return null;

  const count = details.recipients_count;
  const suffix =
    typeof count === "number" && count > value.length
      ? ` (+${count - value.length} more)`
      : "";
  return `${value.join(", ")}${suffix}`;
}

function buildSummary(type: string, details: EmailEventTraceDetails): string {
  const recipients = recipientsDetail(details);
  const reason =
    stringDetail(details, "reason") ??
    stringDetail(details, "error_message") ??
    stringDetail(details, "diagnostic_code");

  switch (type) {
    case "sent": {
      const messageId = stringDetail(details, "message_id");
      return messageId
        ? `Accepted by provider as ${messageId}`
        : "Accepted by provider";
    }
    case "delivered": {
      const smtp = stringDetail(details, "smtp_response");
      return [recipients ? `Delivered to ${recipients}` : "Delivered", smtp]
        .filter(Boolean)
        .join(" — ");
    }
    case "bounced": {
      const bounceType = stringDetail(details, "bounce_type");
      return [
        bounceType ? `${bounceType} bounce` : "Bounce recorded",
        recipients ? `for ${recipients}` : null,
        reason,
      ]
        .filter(Boolean)
        .join(" — ");
    }
    case "complained": {
      const feedbackType = stringDetail(details, "complaint_feedback_type");
      return [
        feedbackType ? `Complaint: ${feedbackType}` : "Complaint recorded",
        recipients ? `from ${recipients}` : null,
      ]
        .filter(Boolean)
        .join(" — ");
    }
    case "delivery_delayed":
      return [
        recipients ? `Delivery delayed for ${recipients}` : "Delivery delayed",
        reason,
      ]
        .filter(Boolean)
        .join(" — ");
    case "failed":
      return reason ? `Failed: ${reason}` : "Provider failure recorded";
    case "opened":
      return recipients ? `Opened by ${recipients}` : "Open recorded";
    case "clicked":
      return recipients ? `Clicked by ${recipients}` : "Click recorded";
    default:
      return reason ?? "Provider event recorded";
  }
}

export function toEmailEventTraceItem(
  event: EmailEventTraceRow,
): EmailEventTraceItem {
  const payload = isRecord(event.payload) ? event.payload : {};
  const mail = readRecord(payload, "mail");
  const error = readRecord(payload, "error");
  const lastError = readRecord(payload, "last_error");
  const extractedRecipients = extractRecipients(payload, mail);
  const details: EmailEventTraceDetails = {};
  const searchSources = [
    payload,
    mail,
    error,
    lastError,
    extractedRecipients.firstRecord,
  ];

  addString(
    details,
    "message_id",
    firstString(searchSources, [
      "sourceMessageId",
      "messageId",
      "message_id",
      "feedbackId",
    ]),
  );
  addString(details, "provider", firstString(searchSources, ["provider"]));
  addString(
    details,
    "reason",
    firstString(searchSources, ["reason", "code", "type"]),
  );
  addString(
    details,
    "error_message",
    firstString(searchSources, ["message", "errorMessage", "error_message"]),
  );
  addString(
    details,
    "bounce_type",
    firstString(searchSources, ["bounceType", "bounce_type"]),
  );
  addString(
    details,
    "bounce_subtype",
    firstString(searchSources, ["bounceSubType", "bounce_subtype"]),
  );
  addString(
    details,
    "complaint_feedback_type",
    firstString(searchSources, [
      "complaintFeedbackType",
      "complaint_feedback_type",
    ]),
  );
  addString(
    details,
    "diagnostic_code",
    firstString(searchSources, ["diagnosticCode", "diagnostic_code"]),
  );
  addString(
    details,
    "smtp_response",
    firstString(searchSources, ["smtpResponse", "smtp_response"]),
  );
  addString(
    details,
    "remote_mta_ip",
    firstString(searchSources, ["remoteMtaIp", "remote_mta_ip"]),
  );
  addString(details, "status", firstString(searchSources, ["status"]));
  addString(details, "action", firstString(searchSources, ["action"]));
  addString(details, "timestamp", firstString(searchSources, ["timestamp"]));
  addNumber(
    details,
    "processing_time_ms",
    firstNumber(searchSources, ["processingTimeMillis", "processing_time_ms"]),
  );
  addNumber(
    details,
    "attempt_count",
    firstNumber(searchSources, ["attempt_count", "attemptCount"]),
  );
  addBoolean(
    details,
    "tls_used",
    firstBoolean(searchSources, ["tlsUsed", "tls_used"]),
  );
  addRecipients(details, extractedRecipients);

  return {
    object: "email_event",
    id: event.id,
    type: event.type,
    created_at: event.receivedAt,
    summary: buildSummary(event.type, details),
    details,
  };
}
