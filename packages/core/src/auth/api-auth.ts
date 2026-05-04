import { createHash } from "node:crypto";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { apiKeys } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";

export interface AuthResult {
  apiKeyId: string;
  permission: string;
  domain: string | null;
}

/**
 * Validate an API key from the Authorization header.
 * Returns the API key record if valid, null otherwise.
 */
export async function validateApiKey(
  authHeader: string | null | undefined,
): Promise<AuthResult | null> {
  if (!authHeader) return null;

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") return null;

  const rawKey = parts[1];
  if (!rawKey) return null;

  const hashedKey = createHash("sha256").update(rawKey).digest("hex");

  const found = await db.query.apiKeys.findFirst({
    where: eq(apiKeys.tokenHash, hashedKey),
  });

  if (!found) return null;

  return {
    apiKeyId: found.id,
    permission: found.permission,
    domain: found.domain,
  };
}

/**
 * Helper to create a 401 JSON response.
 */
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
