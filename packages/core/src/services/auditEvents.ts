import { auditEventRepo } from "../db/repositories/auditEventRepo";
import type { auditEvents } from "../db/schema";

type AuditEventRow = typeof auditEvents.$inferSelect;
type AuditEventInsert = typeof auditEvents.$inferInsert;

type JsonPrimitive = string | number | boolean | null;
export type AuditJsonValue =
  | JsonPrimitive
  | AuditJsonValue[]
  | { [key: string]: AuditJsonValue };

export type AuditAction =
  | "api_key.created"
  | "api_key.updated"
  | "api_key.deleted"
  | "domain.created"
  | "domain.updated"
  | "domain.deleted"
  | "domain.verified"
  | "receiving_route.created"
  | "receiving_route.updated"
  | "receiving_route.deleted"
  | "forwarding_rule.created"
  | "forwarding_rule.updated"
  | "forwarding_rule.deleted"
  | "webhook.created"
  | "webhook.updated"
  | "webhook.deleted"
  | "settings.updated"
  | "team.updated"
  | "team.invitation.created"
  | "team.invitation.revoked"
  | "team.invitation.accepted"
  | "team.member.role_changed"
  | "team.member.removed";

export type AuditTargetType =
  | "api_key"
  | "domain"
  | "receiving_route"
  | "forwarding_rule"
  | "webhook"
  | "settings"
  | "team";

export type AuditActorType = "user" | "api_key" | "system";
export type AuditSource = "dashboard" | "api_key" | "system";

export type AuditActorInput = {
  type: AuditActorType;
  id: string;
  email?: string | null;
};

export type RecordAuditEventInput = {
  userId: string;
  actor: AuditActorInput;
  action: AuditAction;
  target: {
    type: AuditTargetType;
    id: string;
  };
  source: AuditSource;
  sourceApiKeyId?: string | null;
  metadata?: unknown;
};

export type ListAuditEventsInput = {
  userId: string;
  limit?: number;
  action?: string | null;
  targetType?: string | null;
  source?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  search?: string | null;
};

export type AuditEventListItem = Pick<
  AuditEventRow,
  | "id"
  | "userId"
  | "actorType"
  | "actorId"
  | "actorEmail"
  | "action"
  | "targetType"
  | "targetId"
  | "source"
  | "sourceApiKeyId"
  | "metadata"
  | "createdAt"
>;

export type AuditEventRepository = {
  create(data: AuditEventInsert): Promise<AuditEventRow>;
  listForUser(options: {
    userId: string;
    limit: number;
    action?: string;
    targetType?: string;
    source?: string;
    dateFrom?: Date;
    dateTo?: Date;
    search?: string;
  }): Promise<AuditEventRow[]>;
};

export type AuditEventServiceDependencies = {
  repository?: AuditEventRepository;
};

const REDACTED = "[REDACTED]";
const MAX_STRING_LENGTH = 1_000;
const MAX_ARRAY_ITEMS = 25;
const MAX_OBJECT_KEYS = 50;
const MAX_DEPTH = 6;

const REDACTED_KEY_PATTERNS = [
  /authorization/i,
  /cookie/i,
  /api[-_]?key/i,
  /token/i,
  /secret/i,
  /password/i,
  /credential/i,
  /private[-_]?key/i,
  /signing[-_]?secret/i,
  /^html$/i,
  /^text$/i,
  /^content$/i,
  /^content_base64$/i,
];

function shouldRedactKey(key: string): boolean {
  return REDACTED_KEY_PATTERNS.some((pattern) => pattern.test(key));
}

function truncateString(value: string): string {
  if (value.length <= MAX_STRING_LENGTH) return value;
  return `${value.slice(0, MAX_STRING_LENGTH)}…[truncated ${
    value.length - MAX_STRING_LENGTH
  } chars]`;
}

function normalizeLimit(limit: number | undefined): number {
  return Math.min(Math.max(limit || 100, 1), 500);
}

function parseDate(value: string | null | undefined, endOfDay = false) {
  if (!value) return undefined;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;

  if (endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    date.setUTCHours(23, 59, 59, 999);
  }

  return date;
}

function normalizeOptional(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

export function sanitizeAuditMetadata(
  value: unknown,
  depth = 0,
): AuditJsonValue {
  if (depth > MAX_DEPTH) return "[truncated-depth]";
  if (value == null) return null;

  if (typeof value === "string") return truncateString(value);
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "boolean") return value;
  if (value instanceof Date) return value.toISOString();

  if (Array.isArray(value)) {
    const items = value
      .slice(0, MAX_ARRAY_ITEMS)
      .map((item) => sanitizeAuditMetadata(item, depth + 1));
    if (value.length > MAX_ARRAY_ITEMS) {
      items.push(`[truncated ${value.length - MAX_ARRAY_ITEMS} items]`);
    }
    return items;
  }

  if (typeof value === "object") {
    const output: { [key: string]: AuditJsonValue } = {};
    const entries = Object.entries(value as Record<string, unknown>).slice(
      0,
      MAX_OBJECT_KEYS,
    );
    for (const [key, entryValue] of entries) {
      output[key] = shouldRedactKey(key)
        ? REDACTED
        : sanitizeAuditMetadata(entryValue, depth + 1);
    }

    const totalKeys = Object.keys(value as Record<string, unknown>).length;
    if (totalKeys > MAX_OBJECT_KEYS) {
      output.__truncated_keys = totalKeys - MAX_OBJECT_KEYS;
    }

    return output;
  }

  return String(value);
}

export function createAuditEventService({
  repository = auditEventRepo,
}: AuditEventServiceDependencies = {}) {
  return {
    async recordEvent(input: RecordAuditEventInput): Promise<AuditEventRow> {
      return await repository.create({
        userId: input.userId,
        actorType: input.actor.type,
        actorId: input.actor.id,
        actorEmail: input.actor.email ?? null,
        action: input.action,
        targetType: input.target.type,
        targetId: input.target.id,
        source: input.source,
        sourceApiKeyId: input.sourceApiKeyId ?? null,
        metadata:
          input.metadata === undefined
            ? null
            : sanitizeAuditMetadata(input.metadata),
      });
    },

    async listEvents(
      input: ListAuditEventsInput,
    ): Promise<AuditEventListItem[]> {
      return await repository.listForUser({
        userId: input.userId,
        limit: normalizeLimit(input.limit),
        action: normalizeOptional(input.action),
        targetType: normalizeOptional(input.targetType),
        source: normalizeOptional(input.source),
        dateFrom: parseDate(input.dateFrom),
        dateTo: parseDate(input.dateTo, true),
        search: normalizeOptional(input.search),
      });
    },
  };
}

export const auditEventService = createAuditEventService();
