/**
 * Pure cache-key builder functions for domain cache entries.
 *
 * These produce byte-identical keys to the equivalents in src/lib/domain-cache.ts
 * so both the app and the ingester invalidate the exact same Redis keys.
 * No infrastructure dependencies — safe to import anywhere, including @opensend/core.
 */

const DEFAULT_SES_REGION = "us-east-1";

function normalizeSesRegion(region: string | null | undefined): string {
  const trimmed = region?.trim();
  return trimmed || DEFAULT_SES_REGION;
}

/**
 * Cache key for a domain row looked up by its UUID primary key.
 * Matches invalidateDomainByIdCache() in src/lib/domain-cache.ts.
 */
export function getDomainByIdCacheKey(id: string): string {
  return `domain:by-id:${id}`;
}

/**
 * Cache key for the SES identity status of a domain in a specific region.
 * Matches getDomainIdentityCacheKey() in src/lib/domain-cache.ts.
 */
export function getDomainIdentityCacheKey(
  domainName: string,
  region?: string,
): string {
  return `domain:identity:${normalizeSesRegion(region)}:${domainName.trim().toLowerCase()}`;
}

/**
 * Legacy (pre-region-scoped) cache key for the SES identity status.
 * Written before the region-scoped key was introduced; still invalidated
 * when region is unknown to ensure stale entries are cleared.
 * Matches getLegacyDomainIdentityCacheKey() in src/lib/domain-cache.ts.
 */
export function getLegacyDomainIdentityCacheKey(domainName: string): string {
  return `domain:identity:${domainName.trim().toLowerCase()}`;
}
