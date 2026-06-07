import { getCached, setCache } from "@/lib/cache/redis";

const DASHBOARD_AGGREGATE_CACHE_PREFIX = "dashboard-aggregate:v2";

export const DASHBOARD_METRICS_CACHE_TTL_SECONDS = 60;
export const BROADCAST_METRICS_CACHE_TTL_SECONDS = 120;

function normalizeCacheSegment(value: string | null | undefined): string {
  if (value === null || value === undefined) return "all";
  const trimmed = value.trim();
  if (trimmed === "") return "empty";
  return encodeURIComponent(trimmed);
}

export function getMetricsAggregateCacheKey(params: {
  userId: string;
  range: string;
  domain: string | null;
  eventType: string | null;
  tagName: string | null;
  tagValue: string | null;
}): string {
  return [
    DASHBOARD_AGGREGATE_CACHE_PREFIX,
    "metrics",
    normalizeCacheSegment(params.userId),
    normalizeCacheSegment(params.range),
    normalizeCacheSegment(params.domain),
    normalizeCacheSegment(params.eventType),
    normalizeCacheSegment(params.tagName),
    normalizeCacheSegment(params.tagValue),
  ].join(":");
}

export function getBroadcastMetricsCacheKey(params: {
  userId: string;
  broadcastId: string;
}): string {
  return [
    DASHBOARD_AGGREGATE_CACHE_PREFIX,
    "broadcast-metrics",
    normalizeCacheSegment(params.userId),
    normalizeCacheSegment(params.broadcastId),
  ].join(":");
}

export async function readDashboardAggregateCache<T>(
  key: string,
): Promise<T | null> {
  return getCached<T>(key);
}

export async function writeDashboardAggregateCache(
  key: string,
  value: unknown,
  ttlSeconds: number,
): Promise<void> {
  await setCache(key, value, ttlSeconds);
}
