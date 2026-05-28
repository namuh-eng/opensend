/**
 * Domain cache invalidation helpers for the ingester service.
 *
 * Imports key builders from @opensend/core so key strings are never duplicated;
 * the ingester and the app always invalidate exactly the same Redis keys.
 *
 * Redis errors are caught and logged — they must NOT propagate to the caller
 * so that reconcile metrics remain accurate even when Redis is unavailable.
 */

import {
  getDomainByIdCacheKey,
  getDomainIdentityCacheKey,
  getLegacyDomainIdentityCacheKey,
} from "@opensend/core";
import { deleteCache } from "./redis";

async function invalidateDomainByIdCache(id: string): Promise<void> {
  try {
    await deleteCache(getDomainByIdCacheKey(id));
  } catch (err) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "cache.invalidate_failed",
        key_type: "domain:by-id",
        domain_id: id,
        error: err instanceof Error ? err.message : String(err),
      }),
    );
  }
}

async function invalidateDomainIdentityCache(
  domainName: string,
  region?: string | null,
): Promise<void> {
  const normalizedName = domainName.trim().toLowerCase();

  // Always delete both the legacy key (pre-region-scoped) and the
  // region-scoped key so stale entries are cleared regardless of when
  // the row was first cached.
  const keys = region
    ? [getDomainIdentityCacheKey(normalizedName, region)]
    : [
        getLegacyDomainIdentityCacheKey(normalizedName),
        getDomainIdentityCacheKey(normalizedName, "us-east-1"),
        getDomainIdentityCacheKey(normalizedName, "eu-west-1"),
        getDomainIdentityCacheKey(normalizedName, "ap-northeast-1"),
      ];

  await Promise.all(
    keys.map(async (key) => {
      try {
        await deleteCache(key);
      } catch (err) {
        console.error(
          JSON.stringify({
            level: "error",
            event: "cache.invalidate_failed",
            key_type: "domain:identity",
            domain_name: normalizedName,
            error: err instanceof Error ? err.message : String(err),
          }),
        );
      }
    }),
  );
}

/**
 * Invalidates all domain-related caches for a given domain.
 * Matches the signature expected by DomainServiceDependencies.invalidateDomainCaches.
 *
 * This function never throws — Redis errors are caught and logged so that
 * the calling reconcile loop's metrics stay accurate.
 */
export async function invalidateDomainCaches(params: {
  id?: string | null;
  name?: string | null;
  region?: string | null;
}): Promise<void> {
  await Promise.all([
    params.id ? invalidateDomainByIdCache(params.id) : Promise.resolve(),
    params.name
      ? invalidateDomainIdentityCache(params.name, params.region)
      : Promise.resolve(),
  ]);
}
