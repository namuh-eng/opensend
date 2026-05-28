import type { DashboardExportFilters } from "@/lib/dashboard-export-service";
import type { DashboardExportJobFilters } from "@/lib/db/schema";

export type DashboardExportFilterInput = Record<string, unknown>;

function parseDate(value: string | null, boundary: "start" | "end") {
  if (!value) return undefined;

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const suffix = boundary === "start" ? "T00:00:00.000" : "T23:59:59.999";
    const parsed = new Date(`${value}${suffix}`);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function searchParam(
  params: URLSearchParams,
  ...keys: string[]
): string | undefined {
  for (const key of keys) {
    const value = params.get(key)?.trim();
    if (value) return value;
  }
  return undefined;
}

function stringInput(
  input: DashboardExportFilterInput,
  ...keys: string[]
): string | undefined {
  for (const key of keys) {
    const value = input[key];
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) return trimmed;
    }
  }
  return undefined;
}

export function filtersFromSearchParams(
  params: URLSearchParams,
): DashboardExportFilters {
  return {
    search: searchParam(params, "search", "q"),
    status: searchParam(params, "status", "statuses"),
    start: parseDate(
      searchParam(
        params,
        "start_date",
        "startDate",
        "date_from",
        "created_after",
        "after",
      ) ?? null,
      "start",
    ),
    end: parseDate(
      searchParam(
        params,
        "end_date",
        "endDate",
        "date_to",
        "created_before",
        "before",
      ) ?? null,
      "end",
    ),
    apiKeyId: searchParam(params, "api_key_id", "apiKeyId"),
    segmentId: searchParam(
      params,
      "segment_id",
      "segmentId",
      "audience_id",
      "audienceId",
    ),
    region: searchParam(params, "region"),
    permission: searchParam(params, "permission"),
    method: searchParam(params, "method"),
    source: searchParam(params, "source"),
    domain: searchParam(params, "domain"),
    topicId: searchParam(params, "topic_id", "topicId"),
    userAgent: searchParam(params, "user_agent", "userAgent"),
  };
}

export function filtersFromInput(
  input: DashboardExportFilterInput,
): DashboardExportFilters {
  return {
    search: stringInput(input, "search", "q"),
    status: stringInput(input, "status", "statuses"),
    start: parseDate(
      stringInput(input, "start_date", "startDate", "date_from", "after") ??
        null,
      "start",
    ),
    end: parseDate(
      stringInput(input, "end_date", "endDate", "date_to", "before") ?? null,
      "end",
    ),
    apiKeyId: stringInput(input, "api_key_id", "apiKeyId"),
    segmentId: stringInput(
      input,
      "segment_id",
      "segmentId",
      "audience_id",
      "audienceId",
    ),
    region: stringInput(input, "region"),
    permission: stringInput(input, "permission"),
    method: stringInput(input, "method"),
    source: stringInput(input, "source"),
    domain: stringInput(input, "domain"),
    topicId: stringInput(input, "topic_id", "topicId"),
    userAgent: stringInput(input, "user_agent", "userAgent"),
  };
}

export function filtersToMetadata(
  filters: DashboardExportFilters,
): DashboardExportJobFilters {
  const metadata: DashboardExportJobFilters = {};
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined) continue;
    metadata[key] = value instanceof Date ? value.toISOString() : value;
  }
  return metadata;
}
