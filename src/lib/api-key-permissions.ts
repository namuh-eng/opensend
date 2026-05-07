import type { AuthResult } from "@/lib/api-auth";
import { publicApiError, publicApiErrorResponse } from "@/lib/api-errors";
import { db } from "@/lib/db";
import { domains } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

export const API_KEY_PERMISSIONS = {
  fullAccess: "full_access",
  sendingAccess: "sending_access",
} as const;

const INSUFFICIENT_PERMISSION_MESSAGE =
  "This API key does not have permission to access this resource.";
const DOMAIN_RESTRICTION_MESSAGE =
  "This API key is restricted to sending from a different domain.";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isApiKeyAuthResult(
  auth: AuthResult | { dashboard: true },
): auth is AuthResult {
  return "apiKeyId" in auth;
}

export function apiKeyInsufficientPermissionResponse(init?: ResponseInit) {
  return publicApiErrorResponse(
    "insufficient_api_key_permission",
    INSUFFICIENT_PERMISSION_MESSAGE,
    403,
    init,
  );
}

export function requireFullAccessApiKey(auth: AuthResult): Response | null {
  return auth.permission === API_KEY_PERMISSIONS.fullAccess
    ? null
    : apiKeyInsufficientPermissionResponse();
}

export function requireFullAccessForApiKeyCaller(
  auth: AuthResult | { dashboard: true },
): Response | null {
  return isApiKeyAuthResult(auth) ? requireFullAccessApiKey(auth) : null;
}

export function apiKeyDomainRestrictionResponse(
  details: { restrictedDomain: string; fromDomain: string },
  init?: ResponseInit,
) {
  return publicApiErrorResponse(
    "api_key_domain_restricted",
    DOMAIN_RESTRICTION_MESSAGE,
    403,
    { ...init, details },
  );
}

export function getEmailAddressDomain(address: string): string {
  return address.split("@").pop()?.trim().toLowerCase() ?? "";
}

export async function resolveApiKeySendingDomainRestriction(
  auth: AuthResult,
): Promise<string | null> {
  const restriction = auth.domain?.trim().toLowerCase();
  if (!restriction) return null;

  if (!auth.userId) return restriction;

  const found = await db.query.domains.findFirst({
    where: UUID_RE.test(restriction)
      ? and(eq(domains.id, restriction), eq(domains.userId, auth.userId))
      : and(eq(domains.name, restriction), eq(domains.userId, auth.userId)),
  });

  return found?.name.toLowerCase() ?? restriction;
}

export async function requireAllowedSendingDomain(
  auth: AuthResult,
  from: string,
  init?: ResponseInit,
): Promise<Response | null> {
  if (auth.permission !== API_KEY_PERMISSIONS.sendingAccess) return null;

  const restrictedDomain = await resolveApiKeySendingDomainRestriction(auth);
  if (!restrictedDomain) return null;

  const fromDomain = getEmailAddressDomain(from);
  if (fromDomain === restrictedDomain) return null;

  return apiKeyDomainRestrictionResponse(
    { restrictedDomain, fromDomain },
    init,
  );
}

export async function requireAllowedBatchSendingDomains(
  auth: AuthResult,
  fromAddresses: string[],
  init?: ResponseInit,
): Promise<Response | null> {
  if (auth.permission !== API_KEY_PERMISSIONS.sendingAccess) return null;

  const restrictedDomain = await resolveApiKeySendingDomainRestriction(auth);
  if (!restrictedDomain) return null;

  const blockedFrom = fromAddresses.find(
    (from) => getEmailAddressDomain(from) !== restrictedDomain,
  );
  if (!blockedFrom) return null;

  return apiKeyDomainRestrictionResponse(
    {
      restrictedDomain,
      fromDomain: getEmailAddressDomain(blockedFrom),
    },
    init,
  );
}
