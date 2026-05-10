import { emailRepo } from "../db/repositories/emailRepo";
import type { emails } from "../db/schema";

type EmailRow = typeof emails.$inferSelect;
type ProviderRetryRow = Pick<
  EmailRow,
  | "providerRetryCount"
  | "providerLastAttemptedAt"
  | "providerNextRetryAt"
  | "providerLastErrorCode"
  | "providerLastErrorMessage"
  | "providerDeadLetteredAt"
>;

export type EmailReadListRow = Pick<
  EmailRow,
  | "id"
  | "from"
  | "to"
  | "subject"
  | "cc"
  | "bcc"
  | "replyTo"
  | "status"
  | "scheduledAt"
  | "sentAt"
  | "createdAt"
> &
  ProviderRetryRow;

export type EmailReadListItem = {
  id: string;
  from: string;
  to: string[];
  subject: string;
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
  created_at: Date;
};

export type EmailReadListResponse = {
  object: "list";
  has_more: boolean;
  data: EmailReadListItem[];
};

export type EmailReadDetailResponse = EmailReadListItem & {
  object: "email";
  html: string | null;
  text: string | null;
  tags: Array<{ name: string; value: string }> | null;
};

export type EmailReadDeleteResponse = {
  success: true;
};

export type EmailReadRepository = {
  listForApi(options: {
    userId: string;
    limit: number;
    after?: string;
    before?: string;
    status?: string;
  }): Promise<{ data: EmailReadListRow[]; hasMore: boolean }>;
  findByIdForUser(id: string, userId: string): Promise<EmailRow | undefined>;
  deleteForUser(id: string, userId: string): Promise<void>;
};

export type EmailReadServiceErrorCode = "not_found";

export class EmailReadServiceError extends Error {
  constructor(
    readonly code: EmailReadServiceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "EmailReadServiceError";
  }
}

export type EmailReadServiceDependencies = {
  repository?: EmailReadRepository;
};

export type ListEmailsInput = {
  userId: string;
  limit?: number;
  after?: string;
  before?: string;
  status?: string;
};

function normalizeLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit) || limit === 0) {
    return 20;
  }

  return Math.min(Math.max(limit, 1), 100);
}

function normalizeStatus(status: string | undefined): string | undefined {
  const normalized = status?.trim();
  return normalized && normalized !== "all" ? normalized : undefined;
}

function providerLastError(row: ProviderRetryRow) {
  return row.providerLastErrorCode
    ? {
        code: row.providerLastErrorCode,
        message: row.providerLastErrorMessage ?? "Provider send failed.",
      }
    : null;
}

function toListItem(row: EmailReadListRow): EmailReadListItem {
  return {
    id: row.id,
    from: row.from,
    to: row.to,
    subject: row.subject,
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
    created_at: row.createdAt,
  };
}

function toDetail(row: EmailRow): EmailReadDetailResponse {
  return {
    object: "email",
    ...toListItem(row),
    html: row.html,
    text: row.text,
    tags: row.tags,
  };
}

export function createEmailReadService({
  repository = emailRepo,
}: EmailReadServiceDependencies = {}) {
  return {
    async listEmails(input: ListEmailsInput): Promise<EmailReadListResponse> {
      const result = await repository.listForApi({
        userId: input.userId,
        limit: normalizeLimit(input.limit),
        after: input.after ?? undefined,
        before: input.before ?? undefined,
        status: normalizeStatus(input.status),
      });

      return {
        object: "list",
        has_more: result.hasMore,
        data: result.data.map(toListItem),
      };
    },

    async getEmail(
      userId: string,
      id: string,
    ): Promise<EmailReadDetailResponse> {
      const email = await repository.findByIdForUser(id, userId);

      if (!email) {
        throw new EmailReadServiceError("not_found", "Email not found");
      }

      return toDetail(email);
    },

    async deleteEmail(
      userId: string,
      id: string,
    ): Promise<EmailReadDeleteResponse> {
      await repository.deleteForUser(id, userId);
      return { success: true };
    },
  };
}

export const emailReadService = createEmailReadService();
