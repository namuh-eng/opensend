export interface UsageMetric {
  used: number;
  limit: number;
}

export type UsageThreshold = "ok" | "warn" | "critical";

export const USAGE_WARN_RATIO = 0.8;
export const USAGE_CRITICAL_RATIO = 1;

export function getUsageRatio({ used, limit }: UsageMetric): number {
  if (!Number.isFinite(used) || !Number.isFinite(limit)) return 0;
  if (limit <= 0) return used > 0 ? 1 : 0;
  return Math.max(0, used) / limit;
}

export function getUsageThreshold(metric: UsageMetric): UsageThreshold {
  const ratio = getUsageRatio(metric);
  if (ratio >= USAGE_CRITICAL_RATIO) return "critical";
  if (ratio >= USAGE_WARN_RATIO) return "warn";
  return "ok";
}

export function formatUsagePercent(metric: UsageMetric): string {
  const ratio = getUsageRatio(metric);
  const clamped = Math.min(Math.max(ratio, 0), 1);
  return `${Math.round(clamped * 100)}%`;
}

export function getProgressBarPercent(metric: UsageMetric): number {
  const ratio = getUsageRatio(metric);
  return Math.min(Math.max(ratio * 100, 0), 100);
}

export function isOverLimit({ used, limit }: UsageMetric): boolean {
  return limit > 0 && used >= limit;
}
