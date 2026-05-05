import { getCached, setCache } from "@/lib/cache/redis";

const DASHBOARD_AGGREGATE_CACHE_PREFIX = "dashboard-aggregate:v1";

export const DASHBOARD_METRICS_CACHE_TTL_SECONDS = 60;
export const BROADCAST_METRICS_CACHE_TTL_SECONDS = 120;

function normalizeCacheSegment(value: string | null | undefined): string {
  if (!value || value.trim() === "") return "all";
  return encodeURIComponent(value.trim());
}

export function getMetricsAggregateCacheKey(params: {
  range: string;
  domain: string | null;
  eventType: string | null;
}): string {
  return [
    DASHBOARD_AGGREGATE_CACHE_PREFIX,
    "metrics",
    normalizeCacheSegment(params.range),
    normalizeCacheSegment(params.domain),
    normalizeCacheSegment(params.eventType),
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
