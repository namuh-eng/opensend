// ABOUTME: Metrics API endpoint — returns aggregated email stats, daily chart data, and per-domain breakdown

import { getServerSession, unauthorizedResponse } from "@/lib/api-auth";
import { publicApiError } from "@/lib/api-errors";
import {
  DASHBOARD_METRICS_CACHE_TTL_SECONDS,
  getMetricsAggregateCacheKey,
  readDashboardAggregateCache,
  writeDashboardAggregateCache,
} from "@/lib/cache/dashboard-aggregates";
import { getDateRangeBounds } from "@/lib/date-range";
import { parseTagQueryParams } from "@/lib/tag-query-params";
import { createDashboardAggregateService } from "@opensend/core";
import { type NextRequest, NextResponse } from "next/server";

const RANGE_TO_PRESET: Record<string, string> = {
  today: "Today",
  yesterday: "Yesterday",
  last_3_days: "Last 3 days",
  last_7_days: "Last 7 days",
  last_15_days: "Last 15 days",
  last_30_days: "Last 30 days",
};

function getMetricsDateRange(range: string): { start: Date; end: Date } {
  return getDateRangeBounds(RANGE_TO_PRESET[range] || "Last 15 days");
}

function normalizeOptionalQueryParam(value: string | null): string | null {
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

const dashboardAggregateService = createDashboardAggregateService();

// Dashboard-only internal endpoint
export async function GET(request: NextRequest) {
  const session = await getServerSession();
  if (!session) return unauthorizedResponse();

  try {
    const searchParams = request.nextUrl.searchParams;
    const range = searchParams.get("range") || "last_15_days";
    const domain = searchParams.get("domain");
    const eventType = searchParams.get("event_type");
    const parsedTags = parseTagQueryParams(searchParams);
    if (!parsedTags.ok) {
      return NextResponse.json(
        publicApiError(
          "validation_error",
          "Validation failed.",
          422,
          parsedTags.details,
        ),
        { status: 422 },
      );
    }
    const tagName = parsedTags.value.tagName;
    const tagValue = parsedTags.value.tagValue;
    const userId = session.user.id;
    const cacheKey = getMetricsAggregateCacheKey({
      userId,
      range,
      domain,
      eventType,
      tagName,
      tagValue,
    });

    const cached = await readDashboardAggregateCache<unknown>(cacheKey);
    if (cached) {
      return NextResponse.json(cached, {
        headers: { "x-opensend-cache": "hit" },
      });
    }

    const { start, end } = getMetricsDateRange(range);
    const payload = await dashboardAggregateService.getMetrics({
      userId,
      start,
      end,
      domain,
      eventType,
      tagName,
      tagValue,
    });

    await writeDashboardAggregateCache(
      cacheKey,
      payload,
      DASHBOARD_METRICS_CACHE_TTL_SECONDS,
    );

    return NextResponse.json(payload, {
      headers: { "x-opensend-cache": "miss" },
    });
  } catch (error) {
    console.error("Failed to fetch metrics:", error);
    return NextResponse.json(
      { error: "Failed to fetch metrics data" },
      { status: 500 },
    );
  }
}
