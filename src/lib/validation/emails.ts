import { z } from "zod";

// ── Common Fragments ──────────────────────────────────────────────

export const emailAddressSchema = z.string().email().min(3).max(512);

export const emailRecipientSchema = z.union([
  emailAddressSchema,
  z.array(emailAddressSchema),
]);

export const tagSchema = z.object({
  name: z.string().min(1).max(255),
  value: z.string().max(1024),
});

export const attachmentSchema = z.object({
  filename: z.string().min(1).max(255),
  content: z.string().optional(),
  path: z.string().url().optional(),
  content_type: z.string().optional(),
  content_id: z.string().optional(),
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
    tags: z.array(tagSchema).optional(),
    scheduled_at: scheduledAtSchema.optional(),
    topic_id: z.string().uuid().optional(),
    template: z
      .object({
        id: z.string().uuid(),
        variables: z.record(z.string(), z.any()).optional(),
      })
      .optional(),
  })
  .refine((data) => data.html || data.text || data.template, {
    message: "html, text, or template is required",
    path: ["html"],
  });

export const batchSendEmailSchema = z.array(sendEmailSchema).max(100);

export type SendEmailRequest = z.infer<typeof sendEmailSchema>;
export type BatchSendEmailRequest = z.infer<typeof batchSendEmailSchema>;
