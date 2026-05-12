import {
  type CsvHeader,
  type CsvRow,
  DASHBOARD_EXPORT_LIMIT,
  type DashboardCsvExport,
  type DashboardExportResource,
  serializeDashboardCsv,
} from "@/lib/dashboard-export-types";
import { db } from "@/lib/db";
import {
  apiKeys,
  broadcasts,
  contacts,
  contactsToSegments,
  domains,
  emails,
  logs,
  segments,
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

type ApiKeyKey =
  | "id"
  | "name"
  | "token_preview"
  | "permission"
  | "domain"
  | "last_used_at"
  | "created_at";

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

const API_KEY_HEADERS: readonly CsvHeader<ApiKeyKey>[] = [
  { key: "id", label: "id" },
  { key: "name", label: "name" },
  { key: "token_preview", label: "token_preview" },
  { key: "permission", label: "permission" },
  { key: "domain", label: "domain" },
  { key: "last_used_at", label: "last_used_at" },
  { key: "created_at", label: "created_at" },
];

function nonEmpty(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
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
    case "api-keys":
      return apiKeysExport(userId, filters);
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
