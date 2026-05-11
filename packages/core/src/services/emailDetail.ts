import { emailRepo } from "../db/repositories/emailRepo";
import type { emails } from "../db/schema";

type EmailRow = typeof emails.$inferSelect;
type EmailUpdateResult = Pick<EmailRow, "id">;
type ProviderRetryRow = Pick<
  EmailRow,
  | "providerRetryCount"
  | "providerLastAttemptedAt"
  | "providerNextRetryAt"
  | "providerLastErrorCode"
  | "providerLastErrorMessage"
  | "providerDeadLetteredAt"
>;

export type EmailDetailServiceResponse = {
  object: "email";
  id: string;
  from: string;
  to: string[];
  subject: string;
  html: string | null;
  text: string | null;
  cc: string[] | null;
  bcc: string[] | null;
  reply_to: string[] | null;
  last_event: string;
  provider_retry_count: number;
  provider_last_attempted_at: Date | null;
  provider_next_retry_at: Date | null;
  provider_last_error: {
    code: string;
    message: string;
  } | null;
  provider_dead_lettered_at: Date | null;
  scheduled_at: Date | null;
  sent_at: Date | null;
  tags: Array<{ name: string; value: string }> | null;
  created_at: Date;
};

export type EmailDetailServiceUpdateResponse = {
  object: "email";
  id: string;
};

export type EmailDetailRepository = {
  findEmailForUser(id: string, userId: string): Promise<EmailRow | undefined>;
  updateScheduledAtForUser(
    id: string,
    userId: string,
    scheduledAt: Date | null,
  ): Promise<EmailUpdateResult | undefined>;
};

export type EmailDetailParseScheduledAtResult =
  | { ok: true; date: Date }
  | { ok: false; message: string };

export type EmailDetailServiceErrorCode =
  | "not_found"
  | "invalid_state"
  | "invalid_scheduled_at"
  | "no_fields";

export class EmailDetailServiceError extends Error {
  constructor(
    readonly code: EmailDetailServiceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "EmailDetailServiceError";
  }
}

export type EmailDetailServiceDependencies = {
  repository?: EmailDetailRepository;
  parseScheduledAt?: (value: string) => EmailDetailParseScheduledAtResult;
};

export type GetEmailDetailInput = {
  userId: string;
  id: string;
};

export type UpdateEmailDetailInput = {
  userId: string;
  id: string;
  body: unknown;
};

const maxScheduleDelayMs = 30 * 24 * 60 * 60 * 1000;
const naturalLanguageSchedulePattern =
  /^in\s+([1-9]\d*)\s+(min|minute|minutes|hour|hours|day|days)$/i;
const iso8601WithTimezonePattern =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

function defaultParseScheduledAt(
  value: string,
  now: Date = new Date(),
): EmailDetailParseScheduledAtResult {
  const trimmed = value.trim();
  const naturalDate = parseNaturalLanguageScheduledAt(trimmed, now);
  const parsedDate = naturalDate
    ? naturalDate
    : iso8601WithTimezonePattern.test(trimmed)
      ? new Date(trimmed)
      : null;

  if (!parsedDate || !isAllowedScheduledDate(parsedDate, now)) {
    return {
      ok: false,
      message:
        "scheduled_at must be a future ISO 8601 date-time or 'in <positive integer> <minute|min|minutes|hour|hours|day|days>' within 30 days.",
    };
  }

  return { ok: true, date: parsedDate };
}

function isAllowedScheduledDate(date: Date, now: Date): boolean {
  const time = date.getTime();
  const nowTime = now.getTime();
  return (
    Number.isFinite(time) &&
    time > nowTime &&
    time <= nowTime + maxScheduleDelayMs
  );
}

function parseNaturalLanguageScheduledAt(
  value: string,
  now: Date,
): Date | null {
  const match = naturalLanguageSchedulePattern.exec(value.trim());
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

function providerLastError(row: ProviderRetryRow) {
  return row.providerLastErrorCode
    ? {
        code: row.providerLastErrorCode,
        message: row.providerLastErrorMessage ?? "Provider send failed.",
      }
    : null;
}

function toDetail(row: EmailRow): EmailDetailServiceResponse {
  return {
    object: "email",
    id: row.id,
    from: row.from,
    to: row.to,
    subject: row.subject,
    html: row.html,
    text: row.text,
    cc: row.cc,
    bcc: row.bcc,
    reply_to: row.replyTo,
    last_event: row.status,
    provider_retry_count: row.providerRetryCount,
    provider_last_attempted_at: row.providerLastAttemptedAt,
    provider_next_retry_at: row.providerNextRetryAt,
    provider_last_error: providerLastError(row),
    provider_dead_lettered_at: row.providerDeadLetteredAt,
    scheduled_at: row.scheduledAt,
    sent_at: row.sentAt,
    tags: row.tags,
    created_at: row.createdAt,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function invalidScheduledAt(): never {
  throw new EmailDetailServiceError(
    "invalid_scheduled_at",
    "Invalid scheduled_at",
  );
}

const defaultRepository: EmailDetailRepository = {
  async findEmailForUser(id, userId) {
    return await emailRepo.findByIdForUser(id, userId);
  },

  async updateScheduledAtForUser(id, userId, scheduledAt) {
    const [updated] = await emailRepo.update(id, { scheduledAt }, userId);
    return updated ? { id: updated.id } : undefined;
  },
};

export function createEmailDetailService({
  repository = defaultRepository,
  parseScheduledAt = defaultParseScheduledAt,
}: EmailDetailServiceDependencies = {}) {
  return {
    async getEmail(
      input: GetEmailDetailInput,
    ): Promise<EmailDetailServiceResponse> {
      const email = await repository.findEmailForUser(input.id, input.userId);

      if (!email) {
        throw new EmailDetailServiceError("not_found", "Email not found");
      }

      return toDetail(email);
    },

    async updateEmail(
      input: UpdateEmailDetailInput,
    ): Promise<EmailDetailServiceUpdateResponse> {
      if (!isRecord(input.body)) {
        invalidScheduledAt();
      }

      const existing = await repository.findEmailForUser(
        input.id,
        input.userId,
      );

      if (!existing) {
        throw new EmailDetailServiceError("not_found", "Email not found");
      }

      if (existing.status !== "scheduled") {
        throw new EmailDetailServiceError(
          "invalid_state",
          `Cannot update a ${existing.status} email`,
        );
      }

      let scheduledAt: Date | null | undefined;
      if ("scheduled_at" in input.body) {
        const value = input.body.scheduled_at;
        if (value === null) {
          scheduledAt = null;
        } else if (typeof value === "string") {
          const parsed = parseScheduledAt(value);
          if (!parsed.ok) invalidScheduledAt();
          scheduledAt = parsed.date;
        } else {
          invalidScheduledAt();
        }
      }

      if (scheduledAt === undefined) {
        throw new EmailDetailServiceError("no_fields", "No fields to update");
      }

      const updated = await repository.updateScheduledAtForUser(
        input.id,
        input.userId,
        scheduledAt,
      );

      if (!updated) {
        throw new Error("Email update returned no row");
      }

      return {
        object: "email",
        id: updated.id,
      };
    },
  };
}

export const emailDetailService = createEmailDetailService();
