import { createHash } from "node:crypto";
import { deleteCache, readCache, writeCache } from "@/lib/cache/redis";
import { db } from "@/lib/db";
import { apiKeys } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { publicApiErrorResponse } from "./api-errors";
import { auth } from "./auth";

export interface AuthResult {
  apiKeyId: string;
  permission: string;
  domain: string | null;
  userId: string | null;
}

export type ApiKeyAuthHeaderError = "missing_api_key" | "malformed_api_key";
export type ApiKeyAuthErrorCode = ApiKeyAuthHeaderError | "invalid_api_key";

const API_KEY_AUTH_MESSAGES: Record<ApiKeyAuthErrorCode, string> = {
  missing_api_key:
    "Missing API key. Provide an Authorization: Bearer <api_key> header.",
  malformed_api_key:
    "Malformed API key. Use the Authorization: Bearer <api_key> header format.",
  invalid_api_key: "Invalid API key.",
};

const API_KEY_AUTH_CACHE_TTL_SECONDS = 300;

export function getApiKeyAuthHeaderError(
  authHeader: string | null | undefined,
): ApiKeyAuthHeaderError | null {
  if (!authHeader) return "missing_api_key";

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer" || !parts[1]) {
    return "malformed_api_key";
  }

  return null;
}

function getApiKeyAuthCacheKeyFromHash(tokenHash: string): string {
  return `auth:apikey:${tokenHash}`;
}

function logApiKeyCache(
  event: "hit" | "miss" | "unavailable" | "error" | "write" | "invalidate",
  tokenHash: string,
) {
  console.info("[cache][api-key-auth]", {
    event,
    tokenHashPrefix: tokenHash.slice(0, 12),
  });
}

export async function invalidateApiKeyAuthCache(
  tokenHash: string | null | undefined,
): Promise<void> {
  if (!tokenHash) return;

  const status = await deleteCache(getApiKeyAuthCacheKeyFromHash(tokenHash));
  logApiKeyCache(
    status === "deleted"
      ? "invalidate"
      : status === "unavailable"
        ? "unavailable"
        : "error",
    tokenHash,
  );
}

/**
 * Validate an API key from the Authorization header.
 * Returns the API key record if valid, null otherwise.
 */
export async function validateApiKey(
  authHeader: string | null | undefined,
): Promise<AuthResult | null> {
  if (getApiKeyAuthHeaderError(authHeader)) return null;

  const rawKey = authHeader?.split(" ")[1];
  if (!rawKey) return null;

  const hashedKey = createHash("sha256").update(rawKey).digest("hex");
  const cacheKey = getApiKeyAuthCacheKeyFromHash(hashedKey);

  // 1. Try Cache
  const cached = await readCache<AuthResult>(cacheKey);
  logApiKeyCache(cached.status, hashedKey);
  if (cached.status === "hit") return cached.value;

  // 2. Try DB
  const found = await db.query.apiKeys.findFirst({
    where: eq(apiKeys.tokenHash, hashedKey),
  });

  if (!found) return null;

  const result: AuthResult = {
    apiKeyId: found.id,
    permission: found.permission,
    domain: found.domain,
    userId: found.userId,
  };

  // 3. Set Cache (5 min TTL)
  const writeStatus = await writeCache(
    cacheKey,
    result,
    API_KEY_AUTH_CACHE_TTL_SECONDS,
  );
  logApiKeyCache(
    writeStatus === "written"
      ? "write"
      : writeStatus === "unavailable"
        ? "unavailable"
        : "error",
    hashedKey,
  );

  // Background update lastUsedAt to avoid blocking the request
  // Only update once per minute to avoid write amplification
  const now = new Date();
  const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);

  if (!found.lastUsedAt || found.lastUsedAt < oneMinuteAgo) {
    const updatePromise = db
      .update(apiKeys)
      ?.set?.({ lastUsedAt: now })
      ?.where?.(eq(apiKeys.id, found.id))
      ?.execute?.();

    if (updatePromise) {
      updatePromise.catch((err) =>
        console.error("Failed to update API key last_used_at:", err),
      );
    }
  }

  return result;
}

/**
 * Helper to create a 401 JSON response.
 */
export function publicApiKeyUnauthorizedResponse(
  code: ApiKeyAuthErrorCode = "invalid_api_key",
  init?: ResponseInit,
): Response {
  return publicApiErrorResponse(code, API_KEY_AUTH_MESSAGES[code], 401, init);
}

export function unauthorizedResponse(): Response {
  return Response.json(
    { error: "Missing or invalid API key" },
    { status: 401 },
  );
}

/**
 * Get the current server session via Better Auth.
 */
export async function getServerSession() {
  return auth.api.getSession({ headers: await headers() });
}

/**
 * Validate access for dashboard-managed routes that should accept either:
 * - a regular API key, or
 * - an authenticated dashboard session.
 */
export async function authorizeDashboardOrApiKey(
  authHeader: string | null | undefined,
): Promise<AuthResult | { dashboard: true } | null> {
  const apiKeyAuth = await validateApiKey(authHeader);
  if (apiKeyAuth) {
    return apiKeyAuth;
  }

  const session = await getServerSession();
  if (session) {
    return { dashboard: true };
  }

  return null;
}
