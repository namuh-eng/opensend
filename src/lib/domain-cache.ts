import { deleteCache, readCache, writeCache } from "@/lib/cache/redis";
import { db } from "@/lib/db";
import { domains } from "@/lib/db/schema";
import { type GetDomainResult, getDomainIdentity } from "@/lib/ses";
import { validDomainRegions } from "@/lib/validation/domains";
import {
  getDomainByIdCacheKey,
  getDomainIdentityCacheKey,
  getLegacyDomainIdentityCacheKey,
} from "@opensend/core";
import { eq } from "drizzle-orm";

const DOMAIN_DB_CACHE_TTL_SECONDS = 300;
const DOMAIN_IDENTITY_CACHE_TTL_SECONDS = 120;
const DEFAULT_SES_REGION = "us-east-1";

type DomainRow = typeof domains.$inferSelect;

function normalizeSesRegion(region: string | null | undefined): string {
  const trimmed = region?.trim();
  return trimmed || DEFAULT_SES_REGION;
}

function logDomainCache(
  scope: "db" | "identity",
  event: "hit" | "miss" | "unavailable" | "error" | "write" | "invalidate",
  detail: string,
) {
  console.info(`[cache][domain:${scope}]`, {
    event,
    detail,
  });
}

export async function getCachedDomainById(
  id: string,
): Promise<DomainRow | null> {
  const cacheKey = getDomainByIdCacheKey(id);
  const cached = await readCache<DomainRow>(cacheKey);
  logDomainCache("db", cached.status, id);

  if (cached.status === "hit") {
    return cached.value;
  }

  const domain = await db.query.domains.findFirst({
    where: eq(domains.id, id),
  });

  if (!domain) {
    return null;
  }

  const writeStatus = await writeCache(
    cacheKey,
    domain,
    DOMAIN_DB_CACHE_TTL_SECONDS,
  );
  logDomainCache(
    "db",
    writeStatus === "written"
      ? "write"
      : writeStatus === "unavailable"
        ? "unavailable"
        : "error",
    id,
  );

  return domain;
}

export async function getCachedDomainIdentity(
  domainName: string,
  region?: string,
): Promise<GetDomainResult> {
  const normalizedName = domainName.trim().toLowerCase();
  const normalizedRegion = normalizeSesRegion(region);
  const cacheKey = getDomainIdentityCacheKey(normalizedName, normalizedRegion);
  const cached = await readCache<GetDomainResult>(cacheKey);
  logDomainCache(
    "identity",
    cached.status,
    `${normalizedName}:${normalizedRegion}`,
  );

  if (cached.status === "hit" && cached.value) {
    return cached.value;
  }

  const identity = await getDomainIdentity(normalizedName, {
    region: normalizedRegion,
  });
  const writeStatus = await writeCache(
    cacheKey,
    identity,
    DOMAIN_IDENTITY_CACHE_TTL_SECONDS,
  );
  logDomainCache(
    "identity",
    writeStatus === "written"
      ? "write"
      : writeStatus === "unavailable"
        ? "unavailable"
        : "error",
    `${normalizedName}:${normalizedRegion}`,
  );
  return identity;
}

export async function invalidateDomainByIdCache(id: string): Promise<void> {
  const status = await deleteCache(getDomainByIdCacheKey(id));
  logDomainCache(
    "db",
    status === "deleted"
      ? "invalidate"
      : status === "unavailable"
        ? "unavailable"
        : "error",
    id,
  );
}

export async function invalidateDomainIdentityCache(
  domainName: string | null | undefined,
  region?: string | null,
): Promise<void> {
  if (!domainName) return;

  const normalizedName = domainName.trim().toLowerCase();
  const cacheKeys = region
    ? [getDomainIdentityCacheKey(normalizedName, region)]
    : [
        getLegacyDomainIdentityCacheKey(normalizedName),
        ...validDomainRegions.map((candidate) =>
          getDomainIdentityCacheKey(normalizedName, candidate),
        ),
      ];

  await Promise.all(
    cacheKeys.map(async (cacheKey) => {
      const status = await deleteCache(cacheKey);
      logDomainCache(
        "identity",
        status === "deleted"
          ? "invalidate"
          : status === "unavailable"
            ? "unavailable"
            : "error",
        `${normalizedName}:${region ? normalizeSesRegion(region) : "all-regions"}`,
      );
    }),
  );
}

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
