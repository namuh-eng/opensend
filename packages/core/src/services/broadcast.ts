import { broadcastRepo } from "../db/repositories/broadcastRepo";
import type { broadcasts } from "../db/schema";

type BroadcastRow = typeof broadcasts.$inferSelect;
type BroadcastInsert = typeof broadcasts.$inferInsert;

export type BroadcastListItem = Pick<
  BroadcastRow,
  | "id"
  | "name"
  | "status"
  | "audienceId"
  | "topicId"
  | "createdAt"
  | "scheduledAt"
>;

export type BroadcastDetail = Pick<
  BroadcastRow,
  | "id"
  | "name"
  | "status"
  | "from"
  | "subject"
  | "html"
  | "text"
  | "replyTo"
  | "previewText"
  | "audienceId"
  | "topicId"
  | "scheduledAt"
  | "createdAt"
>;

export type BroadcastCreateResult = Pick<
  BroadcastRow,
  "id" | "name" | "status" | "createdAt"
>;

export type BroadcastDeleteResult = {
  id: string;
};

export type BroadcastListResult = {
  data: BroadcastListItem[];
  hasMore: boolean;
};

export type BroadcastServiceErrorCode =
  | "invalid_input"
  | "not_found"
  | "delete_forbidden";

export class BroadcastServiceError extends Error {
  constructor(
    readonly code: BroadcastServiceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "BroadcastServiceError";
  }
}

export type BroadcastRepository = {
  findByIdForUser(
    id: string,
    userId: string,
  ): Promise<BroadcastRow | undefined>;
  create(data: BroadcastInsert): Promise<BroadcastRow[]>;
  updateForUser(
    id: string,
    userId: string,
    data: Record<string, unknown>,
  ): Promise<BroadcastRow[]>;
  deleteForUser(id: string, userId: string): Promise<BroadcastDeleteResult[]>;
  findDeletionCandidateForUser(
    id: string,
    userId: string,
  ): Promise<Pick<BroadcastRow, "status"> | undefined>;
  listForApi(options: {
    userId: string;
    limit: number;
    after?: string;
    search?: string;
    status?: string;
    segmentId?: string;
  }): Promise<BroadcastListResult>;
};

export type BroadcastServiceDependencies = {
  repository?: BroadcastRepository;
};

export type ListBroadcastsInput = {
  userId: string;
  limit?: number;
  after?: string;
  search?: string;
  status?: string;
  segmentId?: string;
};

export type CreateBroadcastInput = {
  userId: string;
  body: unknown;
};

export type UpdateBroadcastInput = {
  userId: string;
  id: string;
  body: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function trimString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function optionalStoredString(value: unknown): string | null {
  return value ? String(value) : null;
}

function normalizeLimit(limit: number | undefined): number {
  return Math.min(120, Math.max(1, limit || 40));
}

function toDetail(row: BroadcastRow): BroadcastDetail {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    from: row.from,
    subject: row.subject,
    html: row.html,
    text: row.text,
    replyTo: row.replyTo,
    previewText: row.previewText,
    audienceId: row.audienceId,
    topicId: row.topicId,
    scheduledAt: row.scheduledAt,
    createdAt: row.createdAt,
  };
}

function buildUpdateData(
  body: Record<string, unknown>,
): Record<string, unknown> {
  const updateData: Record<string, unknown> = {};
  if (body.name !== undefined) updateData.name = body.name;
  if (body.status !== undefined) updateData.status = body.status;
  if (body.from !== undefined) updateData.from = body.from;
  if (body.subject !== undefined) updateData.subject = body.subject;
  if (body.html !== undefined) updateData.html = body.html;
  if (body.text !== undefined) updateData.text = body.text;
  if (body.reply_to !== undefined) updateData.replyTo = body.reply_to;
  if (body.replyTo !== undefined) updateData.replyTo = body.replyTo;
  if (body.preview_text !== undefined)
    updateData.previewText = body.preview_text;
  if (body.previewText !== undefined) updateData.previewText = body.previewText;
  if (body.audience_id !== undefined) updateData.audienceId = body.audience_id;
  if (body.audienceId !== undefined) updateData.audienceId = body.audienceId;
  if (body.topic_id !== undefined) updateData.topicId = body.topic_id;
  if (body.topicId !== undefined) updateData.topicId = body.topicId;
  if (body.scheduled_at !== undefined)
    updateData.scheduledAt = body.scheduled_at;
  if (body.scheduledAt !== undefined) updateData.scheduledAt = body.scheduledAt;
  return updateData;
}

export function createBroadcastService({
  repository = broadcastRepo,
}: BroadcastServiceDependencies = {}) {
  return {
    async listBroadcasts(
      input: ListBroadcastsInput,
    ): Promise<BroadcastListResult> {
      return await repository.listForApi({
        userId: input.userId,
        limit: normalizeLimit(input.limit),
        after: input.after?.trim() || undefined,
        search: input.search?.trim() || undefined,
        status: input.status?.trim() || undefined,
        segmentId: input.segmentId?.trim() || undefined,
      });
    },

    async createBroadcast(
      input: CreateBroadcastInput,
    ): Promise<BroadcastCreateResult> {
      const body = asRecord(input.body);
      const name = trimString(body.name) || "Untitled";
      const from = trimString(body.from);
      const subject = trimString(body.subject);
      const audienceId = body.segment_id || body.audience_id || null;

      if (!from || !subject || !audienceId) {
        throw new BroadcastServiceError(
          "invalid_input",
          "from, subject, and segment_id are required",
        );
      }

      const scheduledAt = body.scheduled_at
        ? new Date(String(body.scheduled_at))
        : null;
      const shouldSend = body.send === true;
      const [broadcast] = await repository.create({
        name,
        from,
        subject,
        audienceId: String(audienceId),
        html: optionalStoredString(body.html),
        text: optionalStoredString(body.text),
        replyTo: optionalStoredString(body.reply_to),
        previewText: optionalStoredString(body.preview_text),
        topicId: optionalStoredString(body.topic_id),
        status: shouldSend ? (scheduledAt ? "scheduled" : "queued") : "draft",
        scheduledAt,
        userId: input.userId,
      });

      return {
        id: broadcast.id,
        name: broadcast.name,
        status: broadcast.status,
        createdAt: broadcast.createdAt,
      };
    },

    async getBroadcast(userId: string, id: string): Promise<BroadcastDetail> {
      const broadcast = await repository.findByIdForUser(id, userId);
      if (!broadcast) {
        throw new BroadcastServiceError("not_found", "Broadcast not found");
      }

      return toDetail(broadcast);
    },

    async updateBroadcast(
      input: UpdateBroadcastInput,
    ): Promise<BroadcastDetail> {
      const [updated] = await repository.updateForUser(
        input.id,
        input.userId,
        buildUpdateData(asRecord(input.body)),
      );

      if (!updated) {
        throw new BroadcastServiceError("not_found", "Broadcast not found");
      }

      return toDetail(updated);
    },

    async deleteBroadcast(
      userId: string,
      id: string,
    ): Promise<BroadcastDeleteResult> {
      const existing = await repository.findDeletionCandidateForUser(
        id,
        userId,
      );

      if (!existing) {
        throw new BroadcastServiceError("not_found", "Broadcast not found");
      }

      if (existing.status !== "draft" && existing.status !== "scheduled") {
        throw new BroadcastServiceError(
          "delete_forbidden",
          "Cannot delete a broadcast that is already sent or queued",
        );
      }

      const [deleted] = await repository.deleteForUser(id, userId);

      if (!deleted) {
        throw new BroadcastServiceError("not_found", "Broadcast not found");
      }

      return deleted;
    },
  };
}
