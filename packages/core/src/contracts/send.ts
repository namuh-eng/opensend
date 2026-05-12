import { z } from "zod";
import { publicApiErrorEnvelopeSchema } from "./public-api-errors";

// ── Common Fragments ──────────────────────────────────────────────

export const MAX_EMAIL_ATTACHMENT_BASE64_BYTES = 40 * 1024 * 1024;

export const emailAddressSchema = z.string().email().min(3).max(512);

export const emailRecipientSchema = z.union([
  emailAddressSchema,
  z.array(emailAddressSchema),
]);

const EMAIL_TAG_PATTERN = /^[A-Za-z0-9_-]*$/;
const EMAIL_TAG_PATTERN_MESSAGE =
  "Tag names and values may only contain ASCII letters, numbers, underscores, or dashes.";
const EMAIL_TAG_LENGTH_MESSAGE =
  "Tag names and values must be no more than 256 characters.";

export const tagSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(256, EMAIL_TAG_LENGTH_MESSAGE)
    .regex(EMAIL_TAG_PATTERN, EMAIL_TAG_PATTERN_MESSAGE),
  value: z
    .string()
    .max(256, EMAIL_TAG_LENGTH_MESSAGE)
    .regex(EMAIL_TAG_PATTERN, EMAIL_TAG_PATTERN_MESSAGE),
});

function hasAllowedAttachmentUrlScheme(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function getBase64EncodedSize(byteLength: number): number {
  return Math.ceil(byteLength / 3) * 4;
}

function getInlineAttachmentEncodedSize(content: string): number {
  const normalized = content.replace(/\s/g, "");
  return normalized.length;
}

function getTotalInlineAttachmentEncodedSize(
  attachments: Array<{ content?: string }> | undefined,
): number {
  return (
    attachments?.reduce(
      (total, attachment) =>
        total +
        (typeof attachment.content === "string"
          ? getInlineAttachmentEncodedSize(attachment.content)
          : 0),
      0,
    ) ?? 0
  );
}

export function getAttachmentBase64EncodedSize(byteLength: number): number {
  return getBase64EncodedSize(byteLength);
}

export const attachmentSchema = z
  .object({
    filename: z.string().min(1).max(255),
    content: z.string().optional(),
    path: z.string().url().optional(),
    content_type: z.string().min(1).optional(),
    content_id: z.string().min(1).optional(),
  })
  .superRefine((attachment, ctx) => {
    if (!attachment.content && !attachment.path) {
      ctx.addIssue({
        code: "custom",
        message: "attachment requires content or path",
        path: ["content"],
      });
    }

    if (attachment.path && !hasAllowedAttachmentUrlScheme(attachment.path)) {
      ctx.addIssue({
        code: "custom",
        message: "attachment path must use http or https",
        path: ["path"],
      });
    }
  });

// ── Scheduled send parsing ────────────────────────────────────────

const MAX_SCHEDULE_DELAY_MS = 30 * 24 * 60 * 60 * 1000;
const NATURAL_LANGUAGE_SCHEDULE_RE =
  /^in\s+([1-9]\d*)\s+(min|minute|minutes|hour|hours|day|days)$/i;
const ISO_8601_WITH_TIMEZONE_RE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

export const scheduledAtValidationMessage =
  "scheduled_at must be a future ISO 8601 date-time or 'in <positive integer> <minute|min|minutes|hour|hours|day|days>' within 30 days.";

export type ScheduledAtParseResult =
  | { ok: true; date: Date }
  | { ok: false; message: string };

function isAllowedScheduledDate(date: Date, now: Date): boolean {
  const time = date.getTime();
  const nowTime = now.getTime();
  return (
    Number.isFinite(time) &&
    time > nowTime &&
    time <= nowTime + MAX_SCHEDULE_DELAY_MS
  );
}

function parseNaturalLanguageScheduledAt(
  value: string,
  now: Date,
): Date | null {
  const match = NATURAL_LANGUAGE_SCHEDULE_RE.exec(value.trim());
  if (!match) return null;

  const amount = Number(match[1]);
  const unit = match[2]?.toLowerCase();
  if (!Number.isSafeInteger(amount)) return null;

  const multiplier = unit?.startsWith("day")
    ? 24 * 60 * 60 * 1000
    : unit?.startsWith("hour")
      ? 60 * 60 * 1000
      : 60 * 1000;

  return new Date(now.getTime() + amount * multiplier);
}

export function parseScheduledAt(
  value: string,
  now: Date = new Date(),
): ScheduledAtParseResult {
  const trimmed = value.trim();
  const naturalDate = parseNaturalLanguageScheduledAt(trimmed, now);
  const parsedDate = naturalDate
    ? naturalDate
    : ISO_8601_WITH_TIMEZONE_RE.test(trimmed)
      ? new Date(trimmed)
      : null;

  if (!parsedDate || !isAllowedScheduledDate(parsedDate, now)) {
    return { ok: false, message: scheduledAtValidationMessage };
  }

  return { ok: true, date: parsedDate };
}

export function normalizeScheduledAt(
  value: string,
  now: Date = new Date(),
): Date {
  const parsed = parseScheduledAt(value, now);
  if (!parsed.ok) {
    throw new Error(parsed.message);
  }
  return parsed.date;
}

const scheduledAtSchema = z.string().superRefine((value, ctx) => {
  const parsed = parseScheduledAt(value);
  if (!parsed.ok) {
    ctx.addIssue({
      code: "custom",
      message: parsed.message,
    });
  }
});

// ── Email Request Schemas ──────────────────────────────────────────

export const sendEmailSchema = z
  .object({
    from: emailAddressSchema,
    to: emailRecipientSchema,
    subject: z.string().min(1).max(1024),
    html: z.string().optional(),
    text: z.string().optional(),
    cc: emailRecipientSchema.optional(),
    bcc: emailRecipientSchema.optional(),
    reply_to: emailRecipientSchema.optional(),
    headers: z.record(z.string(), z.string()).optional(),
    attachments: z.array(attachmentSchema).optional(),
    tags: z.array(tagSchema).max(75).optional(),
    scheduled_at: scheduledAtSchema.optional(),
    topic_id: z.string().uuid().optional(),
    template: z
      .object({
        id: z.string().uuid(),
        variables: z.record(z.string(), z.unknown()).optional(),
      })
      .optional(),
  })
  .refine((data) => data.html || data.text || data.template, {
    message: "html, text, or template is required",
    path: ["html"],
  })
  .refine(
    (data) =>
      getTotalInlineAttachmentEncodedSize(data.attachments) <=
      MAX_EMAIL_ATTACHMENT_BASE64_BYTES,
    {
      message:
        "attachments must be no more than 40MB per email after Base64 encoding",
      path: ["attachments"],
    },
  );

export const batchSendEmailSchema = z.array(sendEmailSchema).max(100);

export const sendEmailResponseSchema = z.object({ id: z.string() }).strict();

export const batchSendEmailItemErrorSchema = z
  .object({ error: publicApiErrorEnvelopeSchema })
  .strict();

export const batchSendEmailItemResponseSchema = z.union([
  sendEmailResponseSchema,
  batchSendEmailItemErrorSchema,
]);

export const batchSendEmailResponseSchema = z
  .object({ data: z.array(batchSendEmailItemResponseSchema) })
  .strict();

export type SendEmailRequest = z.infer<typeof sendEmailSchema>;
export type BatchSendEmailRequest = z.infer<typeof batchSendEmailSchema>;
export type SendEmailSuccessResponse = z.infer<typeof sendEmailResponseSchema>;
export type BatchSendEmailItemResponse = z.infer<
  typeof batchSendEmailItemResponseSchema
>;
export type BatchSendEmailResponseBody = z.infer<
  typeof batchSendEmailResponseSchema
>;

export function normalizeEmailRecipient(
  value: SendEmailRequest["to"] | undefined,
): string[] | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value : [value];
}
