import {
  type CsvHeader,
  type CsvRow,
  DASHBOARD_EXPORT_LIMIT,
  DASHBOARD_EXPORT_SCHEMA_VERSION,
  type DashboardCsvExport,
  type DashboardExportResource,
  serializeDashboardCsv,
} from "@/lib/dashboard-export-types";
import { db } from "@/lib/db";
import {
  type SuppressionReason,
  apiKeys,
  automationRuns,
  automations,
  broadcasts,
  contacts,
  contactsToSegments,
  domains,
  emailEvents,
  emailSuppressions,
  emails,
  logs,
  segments,
  topics,
  webhookDeliveries,
  webhooks,
} from "@/lib/db/schema";
import { type SQL, and, desc, eq, gte, lte, or, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

export type DashboardExportFilters = {
  search?: string;
  status?: string;
  start?: Date;
  end?: Date;
  apiKeyId?: string;
  segmentId?: string;
  region?: string;
  permission?: string;
  method?: string;
  source?: string;
  domain?: string;
  topicId?: string;
  userAgent?: string;
};

export type DashboardCsvExportResult = {
  csv: string;
  rowCount: number;
  resource: DashboardExportResource;
};

export class DashboardExportTooLargeError extends Error {
  readonly code = "export_too_large" as const;

  constructor(
    readonly resource: DashboardExportResource,
    readonly limit: number = DASHBOARD_EXPORT_LIMIT,
  ) {
    super(
      `More than ${limit.toLocaleString("en-US")} ${resource} match these filters. Refine your filters and try again; durable export delivery is tracked as a follow-up.`,
    );
    this.name = "DashboardExportTooLargeError";
  }
}

type EmailKey =
  | "id"
  | "to"
  | "from"
  | "subject"
  | "status"
  | "created_at"
  | "sent_at"
  | "scheduled_at";

type BroadcastKey =
  | "id"
  | "name"
  | "status"
  | "audience_id"
  | "subject"
  | "created_at"
  | "scheduled_at";

type ContactKey =
  | "id"
  | "email"
  | "first_name"
  | "last_name"
  | "status"
  | "segments"
  | "created_at";

type SegmentKey =
  | "id"
  | "name"
  | "contacts_count"
  | "unsubscribed_count"
  | "created_at";

type DomainKey = "id" | "name" | "status" | "region" | "created_at";

type LogKey =
  | "id"
  | "method"
  | "endpoint"
  | "status"
  | "api_key_id"
  | "user_agent"
  | "created_at";

type SuppressionKey =
  | "id"
  | "email"
  | "reason"
  | "source"
  | "source_email_id"
  | "source_message_id"
  | "suppressed_at"
  | "updated_at";

type ApiKeyKey =
  | "id"
  | "name"
  | "token_preview"
  | "permission"
  | "domain"
  | "last_used_at"
  | "created_at";

type EmailEventKey = "id" | "email_id" | "source_id" | "type" | "received_at";

type TopicKey =
  | "id"
  | "name"
  | "description"
  | "default_subscription"
  | "visibility"
  | "created_at";

type WebhookDeliveryKey =
  | "id"
  | "webhook_id"
  | "event_id"
  | "event_type"
  | "attempt"
  | "status"
  | "status_code"
  | "attempted_at"
  | "next_retry_at"
  | "created_at";

type AutomationRunKey =
  | "id"
  | "automation_id"
  | "automation_name"
  | "trigger_event_id"
  | "contact_id"
  | "status"
  | "current_step_key"
  | "started_at"
  | "completed_at"
  | "next_step_at"
  | "failure_reason"
  | "created_at"
  | "updated_at";

const EMAIL_HEADERS: readonly CsvHeader<EmailKey>[] = [
  { key: "id", label: "id" },
  { key: "to", label: "to" },
  { key: "from", label: "from" },
  { key: "subject", label: "subject" },
  { key: "status", label: "status" },
  { key: "created_at", label: "created_at" },
  { key: "sent_at", label: "sent_at" },
  { key: "scheduled_at", label: "scheduled_at" },
];

const BROADCAST_HEADERS: readonly CsvHeader<BroadcastKey>[] = [
  { key: "id", label: "id" },
  { key: "name", label: "name" },
  { key: "status", label: "status" },
  { key: "audience_id", label: "audience_id" },
  { key: "subject", label: "subject" },
  { key: "created_at", label: "created_at" },
  { key: "scheduled_at", label: "scheduled_at" },
];

const CONTACT_HEADERS: readonly CsvHeader<ContactKey>[] = [
  { key: "id", label: "id" },
  { key: "email", label: "email" },
  { key: "first_name", label: "first_name" },
  { key: "last_name", label: "last_name" },
  { key: "status", label: "status" },
  { key: "segments", label: "segments" },
  { key: "created_at", label: "created_at" },
];

const SEGMENT_HEADERS: readonly CsvHeader<SegmentKey>[] = [
  { key: "id", label: "id" },
  { key: "name", label: "name" },
  { key: "contacts_count", label: "contacts_count" },
  { key: "unsubscribed_count", label: "unsubscribed_count" },
  { key: "created_at", label: "created_at" },
];

const DOMAIN_HEADERS: readonly CsvHeader<DomainKey>[] = [
  { key: "id", label: "id" },
  { key: "name", label: "name" },
  { key: "status", label: "status" },
  { key: "region", label: "region" },
  { key: "created_at", label: "created_at" },
];

const LOG_HEADERS: readonly CsvHeader<LogKey>[] = [
  { key: "id", label: "id" },
  { key: "method", label: "method" },
  { key: "endpoint", label: "endpoint" },
  { key: "status", label: "status" },
  { key: "api_key_id", label: "api_key_id" },
  { key: "user_agent", label: "user_agent" },
  { key: "created_at", label: "created_at" },
];

const SUPPRESSION_HEADERS: readonly CsvHeader<SuppressionKey>[] = [
  { key: "id", label: "id" },
  { key: "email", label: "email" },
  { key: "reason", label: "reason" },
  { key: "source", label: "source" },
  { key: "source_email_id", label: "source_email_id" },
  { key: "source_message_id", label: "source_message_id" },
  { key: "suppressed_at", label: "suppressed_at" },
  { key: "updated_at", label: "updated_at" },
];

const API_KEY_HEADERS: readonly CsvHeader<ApiKeyKey>[] = [
  { key: "id", label: "id" },
  { key: "name", label: "name" },
  { key: "token_preview", label: "token_preview" },
  { key: "permission", label: "permission" },
  { key: "domain", label: "domain" },
  { key: "last_used_at", label: "last_used_at" },
  { key: "created_at", label: "created_at" },
];

const EMAIL_EVENT_HEADERS: readonly CsvHeader<EmailEventKey>[] = [
  { key: "id", label: "id" },
  { key: "email_id", label: "email_id" },
  { key: "source_id", label: "source_id" },
  { key: "type", label: "type" },
  { key: "received_at", label: "received_at" },
];

const TOPIC_HEADERS: readonly CsvHeader<TopicKey>[] = [
  { key: "id", label: "id" },
  { key: "name", label: "name" },
  { key: "description", label: "description" },
  { key: "default_subscription", label: "default_subscription" },
  { key: "visibility", label: "visibility" },
  { key: "created_at", label: "created_at" },
];

const WEBHOOK_DELIVERY_HEADERS: readonly CsvHeader<WebhookDeliveryKey>[] = [
  { key: "id", label: "id" },
  { key: "webhook_id", label: "webhook_id" },
  { key: "event_id", label: "event_id" },
  { key: "event_type", label: "event_type" },
  { key: "attempt", label: "attempt" },
  { key: "status", label: "status" },
  { key: "status_code", label: "status_code" },
  { key: "attempted_at", label: "attempted_at" },
  { key: "next_retry_at", label: "next_retry_at" },
  { key: "created_at", label: "created_at" },
];

const AUTOMATION_RUN_HEADERS: readonly CsvHeader<AutomationRunKey>[] = [
  { key: "id", label: "id" },
  { key: "automation_id", label: "automation_id" },
  { key: "automation_name", label: "automation_name" },
  { key: "trigger_event_id", label: "trigger_event_id" },
  { key: "contact_id", label: "contact_id" },
  { key: "status", label: "status" },
  { key: "current_step_key", label: "current_step_key" },
  { key: "started_at", label: "started_at" },
  { key: "completed_at", label: "completed_at" },
  { key: "next_step_at", label: "next_step_at" },
  { key: "failure_reason", label: "failure_reason" },
  { key: "created_at", label: "created_at" },
  { key: "updated_at", label: "updated_at" },
];

function nonEmpty(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function toSuppressionReason(
  value: string | undefined,
): SuppressionReason | undefined {
  return value === "bounced" || value === "complained" || value === "manual"
    ? value
    : undefined;
}

function likePattern(value: string | undefined): string | undefined {
  const trimmed = nonEmpty(value);
  return trimmed ? `%${trimmed}%` : undefined;
}

function iso(value: Date | null | undefined): string {
  return value?.toISOString() ?? "";
}

function pushCreatedAtFilters(
  conditions: SQL[],
  column: AnyPgColumn,
  filters: DashboardExportFilters,
) {
  if (filters.start) conditions.push(gte(column, filters.start));
  if (filters.end) conditions.push(lte(column, filters.end));
}

function assertWithinLimit<T extends string>(
  resource: DashboardExportResource,
  headers: readonly CsvHeader<T>[],
  rows: CsvRow<T>[],
): DashboardCsvExport<T> {
  if (rows.length > DASHBOARD_EXPORT_LIMIT) {
    throw new DashboardExportTooLargeError(resource);
  }
  return { resource, headers, rows };
}

async function emailsExport(
  userId: string,
  filters: DashboardExportFilters,
): Promise<DashboardCsvExport<EmailKey>> {
  const conditions: SQL[] = [eq(emails.userId, userId)];
  const status = nonEmpty(filters.status);
  if (status && status !== "all") conditions.push(eq(emails.status, status));
  pushCreatedAtFilters(conditions, emails.createdAt, filters);

  const pattern = likePattern(filters.search);
  if (pattern) {
    const searchCondition = or(
      sql`${emails.id}::text ILIKE ${pattern}`,
      sql`${emails.to}::text ILIKE ${pattern}`,
      sql`${emails.from} ILIKE ${pattern}`,
      sql`${emails.subject} ILIKE ${pattern}`,
    );
    if (searchCondition) conditions.push(searchCondition);
  }

  const rows = await db
    .select({
      id: emails.id,
      to: emails.to,
      from: emails.from,
      subject: emails.subject,
      status: emails.status,
      createdAt: emails.createdAt,
      sentAt: emails.sentAt,
      scheduledAt: emails.scheduledAt,
    })
    .from(emails)
    .where(and(...conditions))
    .orderBy(desc(emails.createdAt))
    .limit(DASHBOARD_EXPORT_LIMIT + 1);

  return assertWithinLimit(
    "emails",
    EMAIL_HEADERS,
    rows.map((row) => ({
      id: row.id,
      to: row.to.join("; "),
      from: row.from,
      subject: row.subject,
      status: row.status,
      created_at: row.createdAt.toISOString(),
      sent_at: iso(row.sentAt),
      scheduled_at: iso(row.scheduledAt),
    })),
  );
}

async function broadcastsExport(
  userId: string,
  filters: DashboardExportFilters,
): Promise<DashboardCsvExport<BroadcastKey>> {
  const conditions: SQL[] = [eq(broadcasts.userId, userId)];
  const status = nonEmpty(filters.status);
  if (status && status !== "all")
    conditions.push(eq(broadcasts.status, status));
  const segmentId = nonEmpty(filters.segmentId);
  if (segmentId) conditions.push(eq(broadcasts.audienceId, segmentId));
  pushCreatedAtFilters(conditions, broadcasts.createdAt, filters);

  const pattern = likePattern(filters.search);
  if (pattern) {
    const searchCondition = or(
      sql`${broadcasts.id}::text ILIKE ${pattern}`,
      sql`${broadcasts.name} ILIKE ${pattern}`,
      sql`${broadcasts.subject} ILIKE ${pattern}`,
    );
    if (searchCondition) conditions.push(searchCondition);
  }

  const rows = await db
    .select({
      id: broadcasts.id,
      name: broadcasts.name,
      status: broadcasts.status,
      audienceId: broadcasts.audienceId,
      subject: broadcasts.subject,
      createdAt: broadcasts.createdAt,
      scheduledAt: broadcasts.scheduledAt,
    })
    .from(broadcasts)
    .where(and(...conditions))
    .orderBy(desc(broadcasts.createdAt))
    .limit(DASHBOARD_EXPORT_LIMIT + 1);

  return assertWithinLimit(
    "broadcasts",
    BROADCAST_HEADERS,
    rows.map((row) => ({
      id: row.id,
      name: row.name,
      status: row.status,
      audience_id: row.audienceId,
      subject: row.subject,
      created_at: row.createdAt.toISOString(),
      scheduled_at: iso(row.scheduledAt),
    })),
  );
}

async function contactsExport(
  userId: string,
  filters: DashboardExportFilters,
): Promise<DashboardCsvExport<ContactKey>> {
  const conditions: SQL[] = [eq(contacts.userId, userId)];
  const status = nonEmpty(filters.status);
  if (status === "subscribed")
    conditions.push(eq(contacts.unsubscribed, false));
  if (status === "unsubscribed")
    conditions.push(eq(contacts.unsubscribed, true));
  pushCreatedAtFilters(conditions, contacts.createdAt, filters);

  const pattern = likePattern(filters.search);
  if (pattern) {
    const searchCondition = or(
      sql`${contacts.id}::text ILIKE ${pattern}`,
      sql`${contacts.email} ILIKE ${pattern}`,
      sql`${contacts.firstName} ILIKE ${pattern}`,
      sql`${contacts.lastName} ILIKE ${pattern}`,
    );
    if (searchCondition) conditions.push(searchCondition);
  }

  const segmentId = nonEmpty(filters.segmentId);
  if (segmentId) {
    conditions.push(
      sql`exists (select 1 from ${contactsToSegments} where ${contactsToSegments.contactId} = ${contacts.id} and ${contactsToSegments.segmentId} = ${segmentId})`,
    );
  }

  const rows = await db
    .select({
      id: contacts.id,
      email: contacts.email,
      firstName: contacts.firstName,
      lastName: contacts.lastName,
      unsubscribed: contacts.unsubscribed,
      segments: contacts.segments,
      createdAt: contacts.createdAt,
    })
    .from(contacts)
    .where(and(...conditions))
    .orderBy(desc(contacts.createdAt))
    .limit(DASHBOARD_EXPORT_LIMIT + 1);

  return assertWithinLimit(
    "contacts",
    CONTACT_HEADERS,
    rows.map((row) => ({
      id: row.id,
      email: row.email,
      first_name: row.firstName,
      last_name: row.lastName,
      status: row.unsubscribed ? "unsubscribed" : "subscribed",
      segments: Array.isArray(row.segments) ? row.segments.join("; ") : "",
      created_at: row.createdAt.toISOString(),
    })),
  );
}

async function segmentsExport(
  userId: string,
  filters: DashboardExportFilters,
): Promise<DashboardCsvExport<SegmentKey>> {
  const conditions: SQL[] = [eq(segments.userId, userId)];
  pushCreatedAtFilters(conditions, segments.createdAt, filters);

  const pattern = likePattern(filters.search);
  if (pattern) {
    const searchCondition = or(
      sql`${segments.id}::text ILIKE ${pattern}`,
      sql`${segments.name} ILIKE ${pattern}`,
    );
    if (searchCondition) conditions.push(searchCondition);
  }

  const rows = await db
    .select({
      id: segments.id,
      name: segments.name,
      contactsCount: segments.contactsCount,
      unsubscribedCount: segments.unsubscribedCount,
      createdAt: segments.createdAt,
    })
    .from(segments)
    .where(and(...conditions))
    .orderBy(desc(segments.createdAt))
    .limit(DASHBOARD_EXPORT_LIMIT + 1);

  return assertWithinLimit(
    "segments",
    SEGMENT_HEADERS,
    rows.map((row) => ({
      id: row.id,
      name: row.name,
      contacts_count: row.contactsCount,
      unsubscribed_count: row.unsubscribedCount,
      created_at: row.createdAt.toISOString(),
    })),
  );
}

async function domainsExport(
  userId: string,
  filters: DashboardExportFilters,
): Promise<DashboardCsvExport<DomainKey>> {
  const conditions: SQL[] = [eq(domains.userId, userId)];
  const status = nonEmpty(filters.status);
  if (status && status !== "all") conditions.push(eq(domains.status, status));
  const region = nonEmpty(filters.region);
  if (region) conditions.push(eq(domains.region, region));
  pushCreatedAtFilters(conditions, domains.createdAt, filters);

  const pattern = likePattern(filters.search);
  if (pattern) {
    const searchCondition = or(
      sql`${domains.id}::text ILIKE ${pattern}`,
      sql`${domains.name} ILIKE ${pattern}`,
    );
    if (searchCondition) conditions.push(searchCondition);
  }

  const rows = await db
    .select({
      id: domains.id,
      name: domains.name,
      status: domains.status,
      region: domains.region,
      createdAt: domains.createdAt,
    })
    .from(domains)
    .where(and(...conditions))
    .orderBy(desc(domains.createdAt))
    .limit(DASHBOARD_EXPORT_LIMIT + 1);

  return assertWithinLimit(
    "domains",
    DOMAIN_HEADERS,
    rows.map((row) => ({
      id: row.id,
      name: row.name,
      status: row.status,
      region: row.region,
      created_at: row.createdAt.toISOString(),
    })),
  );
}

async function logsExport(
  userId: string,
  filters: DashboardExportFilters,
): Promise<DashboardCsvExport<LogKey>> {
  const conditions: SQL[] = [eq(logs.userId, userId)];
  const status = nonEmpty(filters.status);
  if (status === "2xx") {
    conditions.push(and(gte(logs.status, 200), lte(logs.status, 299)) as SQL);
  } else if (status === "4xx") {
    conditions.push(and(gte(logs.status, 400), lte(logs.status, 499)) as SQL);
  } else if (status === "5xx") {
    conditions.push(gte(logs.status, 500));
  } else if (status && !Number.isNaN(Number(status))) {
    conditions.push(eq(logs.status, Number(status)));
  }

  const method = nonEmpty(filters.method);
  if (method) conditions.push(eq(logs.method, method.toUpperCase()));
  const apiKeyId = nonEmpty(filters.apiKeyId);
  if (apiKeyId) conditions.push(eq(logs.apiKeyId, apiKeyId));
  pushCreatedAtFilters(conditions, logs.createdAt, filters);

  const userAgentPattern = likePattern(filters.userAgent);
  if (userAgentPattern)
    conditions.push(sql`${logs.userAgent} ILIKE ${userAgentPattern}`);

  const pattern = likePattern(filters.search);
  if (pattern) {
    const searchCondition = or(
      sql`${logs.id}::text ILIKE ${pattern}`,
      sql`${logs.endpoint} ILIKE ${pattern}`,
      sql`${logs.userAgent} ILIKE ${pattern}`,
      sql`${logs.status}::text ILIKE ${pattern}`,
      sql`${logs.requestBody}::text ILIKE ${pattern}`,
      sql`${logs.responseBody}::text ILIKE ${pattern}`,
      sql`${logs.document}::text ILIKE ${pattern}`,
    );
    if (searchCondition) conditions.push(searchCondition);
  }

  const rows = await db
    .select({
      id: logs.id,
      method: logs.method,
      endpoint: logs.endpoint,
      status: logs.status,
      apiKeyId: logs.apiKeyId,
      userAgent: logs.userAgent,
      createdAt: logs.createdAt,
    })
    .from(logs)
    .where(and(...conditions))
    .orderBy(desc(logs.createdAt))
    .limit(DASHBOARD_EXPORT_LIMIT + 1);

  return assertWithinLimit(
    "logs",
    LOG_HEADERS,
    rows.map((row) => ({
      id: row.id,
      method: row.method,
      endpoint: row.endpoint,
      status: row.status,
      api_key_id: row.apiKeyId,
      user_agent: row.userAgent,
      created_at: row.createdAt.toISOString(),
    })),
  );
}

async function suppressionsExport(
  userId: string,
  filters: DashboardExportFilters,
): Promise<DashboardCsvExport<SuppressionKey>> {
  const conditions: SQL[] = [eq(emailSuppressions.userId, userId)];
  const reason = toSuppressionReason(nonEmpty(filters.status));
  if (reason) {
    conditions.push(eq(emailSuppressions.reason, reason));
  }
  pushCreatedAtFilters(conditions, emailSuppressions.suppressedAt, filters);

  const pattern = likePattern(filters.search);
  if (pattern) {
    const searchCondition = or(
      sql`${emailSuppressions.id}::text ILIKE ${pattern}`,
      sql`${emailSuppressions.email} ILIKE ${pattern}`,
      sql`${emailSuppressions.sourceEmailId}::text ILIKE ${pattern}`,
      sql`${emailSuppressions.sourceMessageId} ILIKE ${pattern}`,
    );
    if (searchCondition) conditions.push(searchCondition);
  }

  const source = nonEmpty(filters.source ?? filters.method);
  if (source) {
    conditions.push(sql`${emailSuppressions.metadata}->>'source' = ${source}`);
  }

  const domain = nonEmpty(filters.domain)?.toLowerCase();
  if (domain) {
    const domainPattern = `%${domain}%`;
    conditions.push(sql`exists (
      select 1 from ${emails}
      where ${emails.id} = ${emailSuppressions.sourceEmailId}
        and ${emails.userId} = ${userId}
        and lower(${emails.from}) like ${domainPattern}
    )`);
  }

  const topicId = nonEmpty(filters.topicId);
  if (topicId) {
    conditions.push(sql`exists (
      select 1 from ${emails}
      where ${emails.id} = ${emailSuppressions.sourceEmailId}
        and ${emails.userId} = ${userId}
        and ${emails.topicId}::text = ${topicId}
    )`);
  }

  const rows = await db
    .select({
      id: emailSuppressions.id,
      email: emailSuppressions.email,
      reason: emailSuppressions.reason,
      metadata: emailSuppressions.metadata,
      sourceEmailId: emailSuppressions.sourceEmailId,
      sourceMessageId: emailSuppressions.sourceMessageId,
      suppressedAt: emailSuppressions.suppressedAt,
      updatedAt: emailSuppressions.updatedAt,
    })
    .from(emailSuppressions)
    .where(and(...conditions))
    .orderBy(desc(emailSuppressions.suppressedAt))
    .limit(DASHBOARD_EXPORT_LIMIT + 1);

  return assertWithinLimit(
    "suppressions",
    SUPPRESSION_HEADERS,
    rows.map((row) => ({
      id: row.id,
      email: row.email,
      reason: row.reason,
      source: row.metadata?.source ?? "",
      source_email_id: row.sourceEmailId,
      source_message_id: row.sourceMessageId,
      suppressed_at: row.suppressedAt.toISOString(),
      updated_at: row.updatedAt.toISOString(),
    })),
  );
}

export async function apiKeysExport(
  userId: string,
  filters: DashboardExportFilters,
): Promise<DashboardCsvExport<ApiKeyKey>> {
  const conditions: SQL[] = [eq(apiKeys.userId, userId)];
  const permission = nonEmpty(filters.permission ?? filters.status);
  if (permission && permission !== "all") {
    conditions.push(eq(apiKeys.permission, permission));
  }
  pushCreatedAtFilters(conditions, apiKeys.createdAt, filters);

  const pattern = likePattern(filters.search);
  if (pattern) {
    const searchCondition = or(
      sql`${apiKeys.id}::text ILIKE ${pattern}`,
      sql`${apiKeys.name} ILIKE ${pattern}`,
      sql`${apiKeys.tokenPreview} ILIKE ${pattern}`,
    );
    if (searchCondition) conditions.push(searchCondition);
  }

  const rows = await db
    .select({
      id: apiKeys.id,
      name: apiKeys.name,
      tokenPreview: apiKeys.tokenPreview,
      permission: apiKeys.permission,
      domain: apiKeys.domain,
      lastUsedAt: apiKeys.lastUsedAt,
      createdAt: apiKeys.createdAt,
    })
    .from(apiKeys)
    .where(and(...conditions))
    .orderBy(desc(apiKeys.createdAt))
    .limit(DASHBOARD_EXPORT_LIMIT + 1);

  return assertWithinLimit(
    "api-keys",
    API_KEY_HEADERS,
    rows.map((row) => ({
      id: row.id,
      name: row.name,
      token_preview: row.tokenPreview,
      permission: row.permission,
      domain: row.domain,
      last_used_at: iso(row.lastUsedAt),
      created_at: row.createdAt.toISOString(),
    })),
  );
}

async function emailEventsExport(
  userId: string,
  filters: DashboardExportFilters,
): Promise<DashboardCsvExport<EmailEventKey>> {
  const conditions: SQL[] = [eq(emailEvents.userId, userId)];
  const eventType = nonEmpty(filters.status ?? filters.source);
  if (eventType && eventType !== "all")
    conditions.push(eq(emailEvents.type, eventType));
  pushCreatedAtFilters(conditions, emailEvents.receivedAt, filters);

  const pattern = likePattern(filters.search);
  if (pattern) {
    const searchCondition = or(
      sql`${emailEvents.id}::text ILIKE ${pattern}`,
      sql`${emailEvents.emailId}::text ILIKE ${pattern}`,
      sql`${emailEvents.sourceId} ILIKE ${pattern}`,
      sql`${emailEvents.type} ILIKE ${pattern}`,
    );
    if (searchCondition) conditions.push(searchCondition);
  }

  const rows = await db
    .select({
      id: emailEvents.id,
      emailId: emailEvents.emailId,
      sourceId: emailEvents.sourceId,
      type: emailEvents.type,
      receivedAt: emailEvents.receivedAt,
    })
    .from(emailEvents)
    .where(and(...conditions))
    .orderBy(desc(emailEvents.receivedAt))
    .limit(DASHBOARD_EXPORT_LIMIT + 1);

  return assertWithinLimit(
    "email-events",
    EMAIL_EVENT_HEADERS,
    rows.map((row) => ({
      id: row.id,
      email_id: row.emailId,
      source_id: row.sourceId,
      type: row.type,
      received_at: row.receivedAt.toISOString(),
    })),
  );
}

async function topicsExport(
  userId: string,
  filters: DashboardExportFilters,
): Promise<DashboardCsvExport<TopicKey>> {
  const conditions: SQL[] = [eq(topics.userId, userId)];
  const visibility = nonEmpty(filters.status);
  if (visibility && visibility !== "all")
    conditions.push(eq(topics.visibility, visibility));
  pushCreatedAtFilters(conditions, topics.createdAt, filters);

  const pattern = likePattern(filters.search);
  if (pattern) {
    const searchCondition = or(
      sql`${topics.id}::text ILIKE ${pattern}`,
      sql`${topics.name} ILIKE ${pattern}`,
      sql`${topics.description} ILIKE ${pattern}`,
    );
    if (searchCondition) conditions.push(searchCondition);
  }

  const rows = await db
    .select({
      id: topics.id,
      name: topics.name,
      description: topics.description,
      defaultSubscription: topics.defaultSubscription,
      visibility: topics.visibility,
      createdAt: topics.createdAt,
    })
    .from(topics)
    .where(and(...conditions))
    .orderBy(desc(topics.createdAt))
    .limit(DASHBOARD_EXPORT_LIMIT + 1);

  return assertWithinLimit(
    "topics",
    TOPIC_HEADERS,
    rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      default_subscription: row.defaultSubscription,
      visibility: row.visibility,
      created_at: row.createdAt.toISOString(),
    })),
  );
}

async function webhookDeliveriesExport(
  userId: string,
  filters: DashboardExportFilters,
): Promise<DashboardCsvExport<WebhookDeliveryKey>> {
  const conditions: SQL[] = [eq(webhooks.userId, userId)];
  const status = nonEmpty(filters.status);
  if (status && status !== "all")
    conditions.push(eq(webhookDeliveries.status, status));
  pushCreatedAtFilters(conditions, webhookDeliveries.createdAt, filters);

  const pattern = likePattern(filters.search);
  if (pattern) {
    const searchCondition = or(
      sql`${webhookDeliveries.id}::text ILIKE ${pattern}`,
      sql`${webhookDeliveries.webhookId}::text ILIKE ${pattern}`,
      sql`${webhookDeliveries.eventId}::text ILIKE ${pattern}`,
      sql`${emailEvents.type} ILIKE ${pattern}`,
      sql`${webhookDeliveries.responseBody} ILIKE ${pattern}`,
    );
    if (searchCondition) conditions.push(searchCondition);
  }

  const rows = await db
    .select({
      id: webhookDeliveries.id,
      webhookId: webhookDeliveries.webhookId,
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
    .innerJoin(webhooks, eq(webhookDeliveries.webhookId, webhooks.id))
    .innerJoin(emailEvents, eq(webhookDeliveries.eventId, emailEvents.id))
    .where(and(...conditions))
    .orderBy(desc(webhookDeliveries.createdAt))
    .limit(DASHBOARD_EXPORT_LIMIT + 1);

  return assertWithinLimit(
    "webhook-deliveries",
    WEBHOOK_DELIVERY_HEADERS,
    rows.map((row) => ({
      id: row.id,
      webhook_id: row.webhookId,
      event_id: row.eventId,
      event_type: row.eventType,
      attempt: row.attempt,
      status: row.status,
      status_code: row.statusCode,
      attempted_at: iso(row.attemptedAt),
      next_retry_at: iso(row.nextRetryAt),
      created_at: row.createdAt.toISOString(),
    })),
  );
}

async function automationRunsExport(
  userId: string,
  filters: DashboardExportFilters,
): Promise<DashboardCsvExport<AutomationRunKey>> {
  const conditions: SQL[] = [eq(automationRuns.userId, userId)];
  const status = nonEmpty(filters.status);
  if (status && status !== "all")
    conditions.push(eq(automationRuns.status, status));
  pushCreatedAtFilters(conditions, automationRuns.createdAt, filters);

  const pattern = likePattern(filters.search);
  if (pattern) {
    const searchCondition = or(
      sql`${automationRuns.id}::text ILIKE ${pattern}`,
      sql`${automationRuns.automationId}::text ILIKE ${pattern}`,
      sql`${automationRuns.triggerEventId}::text ILIKE ${pattern}`,
      sql`${automationRuns.contactId}::text ILIKE ${pattern}`,
      sql`${automationRuns.failureReason} ILIKE ${pattern}`,
      sql`${automations.name} ILIKE ${pattern}`,
    );
    if (searchCondition) conditions.push(searchCondition);
  }

  const rows = await db
    .select({
      id: automationRuns.id,
      automationId: automationRuns.automationId,
      automationName: automations.name,
      triggerEventId: automationRuns.triggerEventId,
      contactId: automationRuns.contactId,
      status: automationRuns.status,
      currentStepKey: automationRuns.currentStepKey,
      startedAt: automationRuns.startedAt,
      completedAt: automationRuns.completedAt,
      nextStepAt: automationRuns.nextStepAt,
      failureReason: automationRuns.failureReason,
      createdAt: automationRuns.createdAt,
      updatedAt: automationRuns.updatedAt,
    })
    .from(automationRuns)
    .innerJoin(automations, eq(automationRuns.automationId, automations.id))
    .where(and(...conditions))
    .orderBy(desc(automationRuns.createdAt))
    .limit(DASHBOARD_EXPORT_LIMIT + 1);

  return assertWithinLimit(
    "automation-runs",
    AUTOMATION_RUN_HEADERS,
    rows.map((row) => ({
      id: row.id,
      automation_id: row.automationId,
      automation_name: row.automationName,
      trigger_event_id: row.triggerEventId,
      contact_id: row.contactId,
      status: row.status,
      current_step_key: row.currentStepKey,
      started_at: iso(row.startedAt),
      completed_at: iso(row.completedAt),
      next_step_at: iso(row.nextStepAt),
      failure_reason: row.failureReason,
      created_at: row.createdAt.toISOString(),
      updated_at: row.updatedAt.toISOString(),
    })),
  );
}

export function getDashboardExportSchema(resource: DashboardExportResource): {
  version: number;
  headers: readonly string[];
} {
  switch (resource) {
    case "emails":
      return {
        version: DASHBOARD_EXPORT_SCHEMA_VERSION,
        headers: EMAIL_HEADERS.map((header) => header.label),
      };
    case "broadcasts":
      return {
        version: DASHBOARD_EXPORT_SCHEMA_VERSION,
        headers: BROADCAST_HEADERS.map((header) => header.label),
      };
    case "contacts":
      return {
        version: DASHBOARD_EXPORT_SCHEMA_VERSION,
        headers: CONTACT_HEADERS.map((header) => header.label),
      };
    case "segments":
      return {
        version: DASHBOARD_EXPORT_SCHEMA_VERSION,
        headers: SEGMENT_HEADERS.map((header) => header.label),
      };
    case "domains":
      return {
        version: DASHBOARD_EXPORT_SCHEMA_VERSION,
        headers: DOMAIN_HEADERS.map((header) => header.label),
      };
    case "logs":
      return {
        version: DASHBOARD_EXPORT_SCHEMA_VERSION,
        headers: LOG_HEADERS.map((header) => header.label),
      };
    case "suppressions":
      return {
        version: DASHBOARD_EXPORT_SCHEMA_VERSION,
        headers: SUPPRESSION_HEADERS.map((header) => header.label),
      };
    case "api-keys":
      return {
        version: DASHBOARD_EXPORT_SCHEMA_VERSION,
        headers: API_KEY_HEADERS.map((header) => header.label),
      };
    case "email-events":
      return {
        version: DASHBOARD_EXPORT_SCHEMA_VERSION,
        headers: EMAIL_EVENT_HEADERS.map((header) => header.label),
      };
    case "topics":
      return {
        version: DASHBOARD_EXPORT_SCHEMA_VERSION,
        headers: TOPIC_HEADERS.map((header) => header.label),
      };
    case "webhook-deliveries":
      return {
        version: DASHBOARD_EXPORT_SCHEMA_VERSION,
        headers: WEBHOOK_DELIVERY_HEADERS.map((header) => header.label),
      };
    case "automation-runs":
      return {
        version: DASHBOARD_EXPORT_SCHEMA_VERSION,
        headers: AUTOMATION_RUN_HEADERS.map((header) => header.label),
      };
  }
}

export async function loadDashboardCsvExport(
  resource: DashboardExportResource,
  userId: string,
  filters: DashboardExportFilters,
): Promise<DashboardCsvExport> {
  switch (resource) {
    case "emails":
      return emailsExport(userId, filters);
    case "broadcasts":
      return broadcastsExport(userId, filters);
    case "contacts":
      return contactsExport(userId, filters);
    case "segments":
      return segmentsExport(userId, filters);
    case "domains":
      return domainsExport(userId, filters);
    case "logs":
      return logsExport(userId, filters);
    case "suppressions":
      return suppressionsExport(userId, filters);
    case "api-keys":
      return apiKeysExport(userId, filters);
    case "email-events":
      return emailEventsExport(userId, filters);
    case "topics":
      return topicsExport(userId, filters);
    case "webhook-deliveries":
      return webhookDeliveriesExport(userId, filters);
    case "automation-runs":
      return automationRunsExport(userId, filters);
  }
}

export async function createDashboardCsvExport(input: {
  resource: DashboardExportResource;
  userId: string;
  filters: DashboardExportFilters;
}): Promise<DashboardCsvExportResult> {
  const exportData = await loadDashboardCsvExport(
    input.resource,
    input.userId,
    input.filters,
  );

  return {
    resource: input.resource,
    rowCount: exportData.rows.length,
    csv: serializeDashboardCsv(exportData.headers, exportData.rows),
  };
}
