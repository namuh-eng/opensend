import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "../db/client";
import {
  emailEvents,
  emailSuppressions,
  emails,
  logs,
  webhookDeliveries,
  webhooks,
} from "../db/schema";
import {
  type EmailEventTraceDetailValue,
  type EmailEventTraceDetails,
  toEmailEventTraceItem,
} from "./emailEventTrace";

type EmailRow = typeof emails.$inferSelect;
type EmailEventRow = typeof emailEvents.$inferSelect;
type LogRow = typeof logs.$inferSelect;
type SuppressionRow = typeof emailSuppressions.$inferSelect;

type EmailTraceEmailRow = Pick<
  EmailRow,
  | "id"
  | "to"
  | "subject"
  | "status"
  | "scheduledAt"
  | "sentAt"
  | "createdAt"
  | "providerRetryCount"
  | "providerLastAttemptedAt"
  | "providerNextRetryAt"
  | "providerLastErrorCode"
  | "providerLastErrorMessage"
  | "providerDeadLetteredAt"
  | "tags"
>;

type EmailTraceLogRow = Pick<
  LogRow,
  "id" | "method" | "endpoint" | "status" | "apiKeyId" | "createdAt"
>;

type EmailTraceSuppressionRow = Pick<
  SuppressionRow,
  | "id"
  | "email"
  | "reason"
  | "sourceEmailId"
  | "sourceMessageId"
  | "metadata"
  | "suppressedAt"
>;

export type EmailTraceWebhookDeliveryRow = {
  id: string;
  webhookId: string;
  webhookUrl: string | null;
  eventId: string;
  eventType: string;
  attempt: number;
  status: string;
  statusCode: number | null;
  attemptedAt: Date | null;
  nextRetryAt: Date | null;
  createdAt: Date;
};

export type EmailTraceSource =
  | "request"
  | "queue"
  | "provider"
  | "webhook"
  | "suppression";

export type EmailTraceItem = {
  object: "email_trace_event";
  id: string;
  source: EmailTraceSource;
  type: string;
  created_at: Date;
  summary: string;
  details: EmailEventTraceDetails;
  related_id: string | null;
  related_url: string | null;
};

export type EmailTraceResponse = {
  object: "email_trace";
  email_id: string;
  data: EmailTraceItem[];
};

export type EmailTraceRepository = {
  findEmailForUser(
    id: string,
    userId: string,
  ): Promise<EmailTraceEmailRow | undefined>;
  listEventsByEmailIdAsc(emailId: string): Promise<EmailEventRow[]>;
  listLogsForEmail(
    userId: string,
    emailId: string,
  ): Promise<EmailTraceLogRow[]>;
  listWebhookDeliveriesForEmail(
    userId: string,
    emailId: string,
  ): Promise<EmailTraceWebhookDeliveryRow[]>;
  findSuppressionForEmail(
    userId: string,
    emailId: string,
    recipient: string | null,
  ): Promise<EmailTraceSuppressionRow | undefined>;
};

export type EmailTraceServiceErrorCode = "email_not_found";

export class EmailTraceServiceError extends Error {
  constructor(
    readonly code: EmailTraceServiceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "EmailTraceServiceError";
  }
}

export type EmailTraceServiceDependencies = {
  repository?: EmailTraceRepository;
};

const defaultRepository: EmailTraceRepository = {
  async findEmailForUser(id, userId) {
    return await db.query.emails.findFirst({
      where: and(eq(emails.id, id), eq(emails.userId, userId)),
    });
  },

  async listEventsByEmailIdAsc(emailId) {
    return await db
      .select()
      .from(emailEvents)
      .where(eq(emailEvents.emailId, emailId))
      .orderBy(asc(emailEvents.receivedAt));
  },

  async listLogsForEmail(userId, emailId) {
    return await db
      .select({
        id: logs.id,
        method: logs.method,
        endpoint: logs.endpoint,
        status: logs.status,
        apiKeyId: logs.apiKeyId,
        createdAt: logs.createdAt,
      })
      .from(logs)
      .where(
        and(
          eq(logs.userId, userId),
          sql`(${logs.document}->>'emailId' = ${emailId} OR coalesce(${logs.document}->'emailIds', '[]'::jsonb) ? ${emailId})`,
        ),
      )
      .orderBy(asc(logs.createdAt))
      .limit(20);
  },

  async listWebhookDeliveriesForEmail(userId, emailId) {
    return await db
      .select({
        id: webhookDeliveries.id,
        webhookId: webhookDeliveries.webhookId,
        webhookUrl: webhooks.url,
        eventId: webhookDeliveries.eventId,
        eventType: emailEvents.type,
        attempt: webhookDeliveries.attempt,
        status: webhookDeliveries.status,
        statusCode: webhookDeliveries.statusCode,
        attemptedAt: webhookDeliveries.attemptedAt,
        nextRetryAt: webhookDeliveries.nextRetryAt,
        createdAt: webhookDeliveries.createdAt,
      })
      .from(webhookDeliveries)
      .innerJoin(emailEvents, eq(webhookDeliveries.eventId, emailEvents.id))
      .innerJoin(webhooks, eq(webhookDeliveries.webhookId, webhooks.id))
      .where(
        and(
          eq(emailEvents.emailId, emailId),
          eq(emailEvents.userId, userId),
          eq(webhooks.userId, userId),
        ),
      )
      .orderBy(asc(webhookDeliveries.createdAt))
      .limit(50);
  },

  async findSuppressionForEmail(userId, emailId, recipient) {
    const recipientFilter = recipient
      ? eq(emailSuppressions.email, recipient.toLowerCase())
      : undefined;
    return await db.query.emailSuppressions.findFirst({
      where: and(
        eq(emailSuppressions.userId, userId),
        sql`(${emailSuppressions.sourceEmailId} = ${emailId}::uuid OR ${recipientFilter ?? sql`false`})`,
      ),
      orderBy: desc(emailSuppressions.suppressedAt),
    });
  },
};

function item(input: Omit<EmailTraceItem, "object">): EmailTraceItem {
  return { object: "email_trace_event", ...input };
}

function detailString(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function addDetail(
  details: EmailEventTraceDetails,
  key: string,
  value: EmailEventTraceDetailValue | null | undefined,
): void {
  if (value === null || value === undefined) return;
  if (typeof value === "string" && value.trim() === "") return;
  if (Array.isArray(value) && value.length === 0) return;
  details[key] = value;
}

function tagDetails(tags: EmailTraceEmailRow["tags"]): string[] {
  if (!Array.isArray(tags)) return [];
  return tags
    .filter(
      (tag): tag is { name: string; value: string } =>
        typeof tag?.name === "string" && typeof tag?.value === "string",
    )
    .map((tag) => `${tag.name}=${tag.value}`);
}

function queueItems(email: EmailTraceEmailRow): EmailTraceItem[] {
  const details: EmailEventTraceDetails = { status: email.status };
  addDetail(details, "tags", tagDetails(email.tags));

  const rows = [
    item({
      id: `email:${email.id}:created`,
      source: "queue",
      type: "created",
      created_at: email.createdAt,
      summary: `Email record created in ${email.status} state`,
      details,
      related_id: email.id,
      related_url: `/emails/${email.id}`,
    }),
  ];

  if (email.scheduledAt) {
    rows.push(
      item({
        id: `email:${email.id}:scheduled`,
        source: "queue",
        type: "scheduled",
        created_at: email.scheduledAt,
        summary: "Email scheduled for delivery",
        details: { scheduled_at: email.scheduledAt.toISOString() },
        related_id: email.id,
        related_url: `/emails/${email.id}`,
      }),
    );
  }

  if (email.sentAt) {
    rows.push(
      item({
        id: `email:${email.id}:sent`,
        source: "queue",
        type: "sent",
        created_at: email.sentAt,
        summary: "Email handed to provider worker",
        details: { sent_at: email.sentAt.toISOString() },
        related_id: email.id,
        related_url: `/emails/${email.id}`,
      }),
    );
  }

  if (email.providerLastAttemptedAt) {
    const retryDetails: EmailEventTraceDetails = {
      provider_retry_count: email.providerRetryCount,
    };
    addDetail(
      retryDetails,
      "next_retry_at",
      email.providerNextRetryAt?.toISOString(),
    );
    addDetail(
      retryDetails,
      "error_code",
      detailString(email.providerLastErrorCode),
    );
    addDetail(
      retryDetails,
      "error_message",
      detailString(email.providerLastErrorMessage),
    );
    rows.push(
      item({
        id: `email:${email.id}:provider-attempt`,
        source: "provider",
        type: email.providerLastErrorCode
          ? "provider_retry"
          : "provider_attempt",
        created_at: email.providerLastAttemptedAt,
        summary: email.providerLastErrorCode
          ? "Provider send attempt failed"
          : "Provider send attempt recorded",
        details: retryDetails,
        related_id: email.id,
        related_url: `/emails/${email.id}`,
      }),
    );
  }

  if (email.providerDeadLetteredAt) {
    rows.push(
      item({
        id: `email:${email.id}:dead-lettered`,
        source: "provider",
        type: "provider_dead_lettered",
        created_at: email.providerDeadLetteredAt,
        summary: "Provider retries exhausted",
        details: { provider_retry_count: email.providerRetryCount },
        related_id: email.id,
        related_url: `/emails/${email.id}`,
      }),
    );
  }

  return rows;
}

function logItems(rows: EmailTraceLogRow[]): EmailTraceItem[] {
  return rows.map((row) => {
    const method = row.method ?? "GET";
    const endpoint = row.endpoint ?? "";
    const status = row.status ?? 0;
    return item({
      id: `log:${row.id}`,
      source: "request",
      type: "api_request",
      created_at: row.createdAt,
      summary: `${method} ${endpoint || "request"} returned ${status}`,
      details: {
        method,
        endpoint,
        status_code: status,
        ...(row.apiKeyId ? { api_key_id: row.apiKeyId } : {}),
      },
      related_id: row.id,
      related_url: `/logs/${row.id}`,
    });
  });
}

function eventItems(rows: EmailEventRow[]): EmailTraceItem[] {
  return rows.map((row) => {
    const trace = toEmailEventTraceItem(row);
    return item({
      id: `event:${trace.id}`,
      source: "provider",
      type: trace.type,
      created_at: trace.created_at,
      summary: trace.summary,
      details: trace.details,
      related_id: trace.id,
      related_url: null,
    });
  });
}

function webhookItems(rows: EmailTraceWebhookDeliveryRow[]): EmailTraceItem[] {
  return rows.map((row) => {
    const details: EmailEventTraceDetails = {
      webhook_id: row.webhookId,
      event_id: row.eventId,
      event_type: row.eventType,
      attempt: row.attempt,
      status: row.status,
    };
    addDetail(details, "status_code", row.statusCode ?? undefined);
    addDetail(details, "next_retry_at", row.nextRetryAt?.toISOString());
    return item({
      id: `webhook:${row.id}`,
      source: "webhook",
      type: "webhook_delivery",
      created_at: row.attemptedAt ?? row.createdAt,
      summary: `Webhook delivery ${row.status}`,
      details,
      related_id: row.id,
      related_url: row.webhookUrl ? `/webhooks/${row.webhookId}` : null,
    });
  });
}

function suppressionItem(row: EmailTraceSuppressionRow): EmailTraceItem {
  const details: EmailEventTraceDetails = {
    email: row.email,
    reason: row.reason,
  };
  addDetail(details, "source", row.metadata?.source);
  addDetail(details, "source_email_id", row.sourceEmailId ?? undefined);
  addDetail(details, "source_message_id", row.sourceMessageId ?? undefined);

  return item({
    id: `suppression:${row.id}`,
    source: "suppression",
    type: "suppressed",
    created_at: row.suppressedAt,
    summary: `${row.email} suppressed (${row.reason})`,
    details,
    related_id: row.id,
    related_url: `/suppressions?search=${encodeURIComponent(row.email)}`,
  });
}

function sortTraceItems(items: EmailTraceItem[]): EmailTraceItem[] {
  const sourceOrder: Record<EmailTraceSource, number> = {
    request: 0,
    queue: 1,
    provider: 2,
    webhook: 3,
    suppression: 4,
  };

  return [...items].sort((left, right) => {
    const timeDiff = left.created_at.getTime() - right.created_at.getTime();
    if (timeDiff !== 0) return timeDiff;
    const sourceDiff = sourceOrder[left.source] - sourceOrder[right.source];
    return sourceDiff !== 0 ? sourceDiff : left.id.localeCompare(right.id);
  });
}

export function createEmailTraceService({
  repository = defaultRepository,
}: EmailTraceServiceDependencies = {}) {
  return {
    async getTrace(
      userId: string,
      emailId: string,
    ): Promise<EmailTraceResponse> {
      const email = await repository.findEmailForUser(emailId, userId);
      if (!email) {
        throw new EmailTraceServiceError("email_not_found", "Email not found");
      }

      const primaryRecipient = email.to[0]?.toLowerCase() ?? null;
      const [events, requestLogs, webhookRows, suppression] = await Promise.all(
        [
          repository.listEventsByEmailIdAsc(emailId),
          repository.listLogsForEmail(userId, emailId),
          repository.listWebhookDeliveriesForEmail(userId, emailId),
          repository.findSuppressionForEmail(userId, emailId, primaryRecipient),
        ],
      );

      const traceItems = [
        ...queueItems(email),
        ...logItems(requestLogs),
        ...eventItems(events),
        ...webhookItems(webhookRows),
        ...(suppression ? [suppressionItem(suppression)] : []),
      ];

      return {
        object: "email_trace",
        email_id: email.id,
        data: sortTraceItems(traceItems),
      };
    },
  };
}

export const emailTraceService = createEmailTraceService();
