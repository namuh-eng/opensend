import { logRepo } from "../db/repositories/logRepo";
import type { logs } from "../db/schema";

type LogRow = typeof logs.$inferSelect;

export type LogListRow = Pick<
  LogRow,
  | "id"
  | "method"
  | "endpoint"
  | "status"
  | "userAgent"
  | "apiKeyId"
  | "createdAt"
>;

export type LogPublicListItem = {
  id: string;
  method: string | null;
  endpoint: string | null;
  response_status: number | null;
  user_agent: string | null;
  api_key_id: string | null;
  created_at: Date;
};

export type LogPublicListResponse = {
  object: "list";
  data: LogPublicListItem[];
  has_more: boolean;
};

export type LogPublicDetailResponse = {
  object: "log";
  id: string;
  method: string | null;
  endpoint: string | null;
  status: number | null;
  user_agent: string | null;
  api_key_id: string | null;
  request_body: unknown;
  response_body: unknown;
  created_at: Date;
};

export type LogRepository = {
  listForApi(options: {
    userId: string;
    limit: number;
    status?: number;
    method?: string;
    apiKeyId?: string;
    after?: string;
    before?: string;
    dateFrom?: Date;
    dateTo?: Date;
    userAgent?: string;
    search?: string;
    tagName?: string;
    tagValue?: string;
  }): Promise<{ data: LogListRow[]; hasMore: boolean }>;
  findByIdForUser(id: string, userId: string): Promise<LogRow | undefined>;
};

export type LogReadServiceErrorCode = "not_found";

export class LogReadServiceError extends Error {
  constructor(
    readonly code: LogReadServiceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "LogReadServiceError";
  }
}

export type LogReadServiceDependencies = {
  repository?: LogRepository;
};

export type ListLogsInput = {
  userId: string;
  limit?: number;
  status?: string | null;
  method?: string | null;
  apiKeyId?: string | null;
  after?: string | null;
  before?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  userAgent?: string | null;
  search?: string | null;
  tagName?: string | null;
  tagValue?: string | null;
};

function normalizeLimit(limit: number | undefined): number {
  return Math.min(Math.max(limit || 20, 1), 100);
}

function parseDate(value: string | null | undefined, endOfDay = false) {
  if (!value) return undefined;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;

  if (endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    date.setHours(23, 59, 59, 999);
  }

  return date;
}

function normalizeOptionalString(value: string | null | undefined) {
  return value || undefined;
}

function normalizeSearch(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function toListItem(row: LogListRow): LogPublicListItem {
  return {
    id: row.id,
    method: row.method,
    endpoint: row.endpoint,
    response_status: row.status,
    user_agent: row.userAgent,
    api_key_id: row.apiKeyId,
    created_at: row.createdAt,
  };
}

function toDetail(row: LogRow): LogPublicDetailResponse {
  return {
    object: "log",
    id: row.id,
    method: row.method,
    endpoint: row.endpoint,
    status: row.status,
    user_agent: row.userAgent,
    api_key_id: row.apiKeyId,
    request_body: row.requestBody,
    response_body: row.responseBody,
    created_at: row.createdAt,
  };
}

export function createLogReadService({
  repository = logRepo,
}: LogReadServiceDependencies = {}) {
  return {
    async listLogs(input: ListLogsInput): Promise<LogPublicListResponse> {
      const result = await repository.listForApi({
        userId: input.userId,
        limit: normalizeLimit(input.limit),
        status: input.status ? Number(input.status) : undefined,
        method: input.method ? input.method.toUpperCase() : undefined,
        apiKeyId: normalizeOptionalString(input.apiKeyId),
        after: normalizeOptionalString(input.after),
        before: normalizeOptionalString(input.before),
        dateFrom: parseDate(input.dateFrom),
        dateTo: parseDate(input.dateTo, true),
        userAgent: normalizeOptionalString(input.userAgent),
        search: normalizeSearch(input.search),
        tagName: normalizeOptionalString(input.tagName),
        tagValue:
          input.tagName && input.tagValue !== null
            ? (input.tagValue ?? "")
            : undefined,
      });

      return {
        object: "list",
        data: result.data.map(toListItem),
        has_more: result.hasMore,
      };
    },

    async getLog(userId: string, id: string): Promise<LogPublicDetailResponse> {
      const log = await repository.findByIdForUser(id, userId);

      if (!log) {
        throw new LogReadServiceError("not_found", "Log not found");
      }

      return toDetail(log);
    },
  };
}

export const logReadService = createLogReadService();
