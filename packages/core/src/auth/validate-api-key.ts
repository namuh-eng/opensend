import { createHash } from "node:crypto";
import { apiKeyRepo } from "../db/repositories/apiKeyRepo";

export interface ApiKeyValidationResult {
  userId: string;
  apiKeyId: string;
  permission: string;
  domain: string | null;
}

/**
 * Validate a raw OpenSend API key (e.g. os_live_...) without any HTTP/Next.js
 * dependencies. Suitable for use from standalone services such as the SMTP relay.
 *
 * Returns null if the key is missing, malformed, or not found in the database.
 */
export async function validateApiKeyRaw(
  rawKey: string | null | undefined,
): Promise<ApiKeyValidationResult | null> {
  if (!rawKey || typeof rawKey !== "string" || rawKey.trim().length === 0) {
    return null;
  }

  const trimmed = rawKey.trim();
  const tokenHash = createHash("sha256").update(trimmed).digest("hex");

  const record = await apiKeyRepo.findByHash(tokenHash);
  if (!record) return null;
  if (!record.userId) return null;

  return {
    userId: record.userId,
    apiKeyId: record.id,
    permission: record.permission,
    domain: record.domain ?? null,
  };
}
