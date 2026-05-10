import { suppressionRepo } from "../db/repositories/suppressionRepo";
import type {
  SuppressionReason,
  SuppressionSourceMetadata,
  emailSuppressions,
} from "../db/schema";

type SuppressionRow = typeof emailSuppressions.$inferSelect;

export type SuppressionPublicItem = {
  id: string;
  object: "suppression";
  email: string;
  reason: SuppressionReason;
  scope: "user";
  source_event_id: string | null;
  source_email_id: string | null;
  source_message_id: string | null;
  metadata: SuppressionSourceMetadata | null;
  suppressed_at: string;
  updated_at: string;
};

export type SuppressionListResponse = {
  object: "list";
  scope: "user";
  data: SuppressionPublicItem[];
  has_more: boolean;
};

export type SuppressionDeleteResponse = {
  object: "suppression";
  deleted: true;
};

export type SuppressionRepository = {
  list(options: {
    userId: string;
    limit: number;
    after?: string;
  }): Promise<{ data: SuppressionRow[]; hasMore: boolean }>;
  removeForUser(userId: string, email: string): Promise<Array<{ id: string }>>;
};

export type SuppressionServiceErrorCode = "not_found";

export class SuppressionServiceError extends Error {
  constructor(
    readonly code: SuppressionServiceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "SuppressionServiceError";
  }
}

export type SuppressionServiceDependencies = {
  repository?: SuppressionRepository;
};

export type ListSuppressionsInput = {
  userId: string;
  limit?: number;
  after?: string | null;
};

function normalizeLimit(limit: number | undefined): number {
  return Math.min(Math.max(limit || 50, 1), 100);
}

function toPublicItem(row: SuppressionRow): SuppressionPublicItem {
  return {
    id: row.id,
    object: "suppression",
    email: row.email,
    reason: row.reason,
    scope: "user",
    source_event_id: row.sourceEventId,
    source_email_id: row.sourceEmailId,
    source_message_id: row.sourceMessageId,
    metadata: row.metadata ?? null,
    suppressed_at: row.suppressedAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

export function createSuppressionService({
  repository = suppressionRepo,
}: SuppressionServiceDependencies = {}) {
  return {
    async listSuppressions(
      input: ListSuppressionsInput,
    ): Promise<SuppressionListResponse> {
      const result = await repository.list({
        userId: input.userId,
        limit: normalizeLimit(input.limit),
        after: input.after || undefined,
      });

      return {
        object: "list",
        scope: "user",
        data: result.data.map(toPublicItem),
        has_more: result.hasMore,
      };
    },

    async deleteSuppression(
      userId: string,
      email: string,
    ): Promise<SuppressionDeleteResponse> {
      const removed = await repository.removeForUser(userId, email);

      if (removed.length === 0) {
        throw new SuppressionServiceError("not_found", "Suppression not found");
      }

      return { object: "suppression", deleted: true };
    },
  };
}

export const suppressionService = createSuppressionService();
