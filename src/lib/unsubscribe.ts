import { createHmac, timingSafeEqual } from "node:crypto";

export const RESEND_UNSUBSCRIBE_URL = "{{{RESEND_UNSUBSCRIBE_URL}}}";
export const LIST_UNSUBSCRIBE_HEADER = "List-Unsubscribe";
export const LIST_UNSUBSCRIBE_POST_HEADER = "List-Unsubscribe-Post";
export const LIST_UNSUBSCRIBE_POST_VALUE = "List-Unsubscribe=One-Click";

function getUnsubscribeSecret(): string {
  // Production must use a dedicated UNSUBSCRIBE_SECRET so that compromising
  // an unrelated secret (Better Auth session, dashboard) cannot be replayed
  // to forge unsubscribe tokens. Dev keeps a single-purpose fallback to
  // avoid bootstrap friction for self-hosters running the dev server.
  if (process.env.NODE_ENV === "production") {
    const secret = process.env.UNSUBSCRIBE_SECRET?.trim();
    if (!secret || secret.length < 16) {
      throw new Error(
        "UNSUBSCRIBE_SECRET must be set to at least 16 chars in production",
      );
    }
    return secret;
  }
  return process.env.UNSUBSCRIBE_SECRET ?? "opensend-local-unsubscribe-secret";
}

function signContactId(contactId: string): string {
  return createHmac("sha256", getUnsubscribeSecret())
    .update(`opensend.unsubscribe.v1:${contactId}`)
    .digest("base64url");
}

export function createUnsubscribeToken(contactId: string): string {
  return signContactId(contactId);
}

export function verifyUnsubscribeToken(
  contactId: string,
  token: string | null | undefined,
): boolean {
  if (!token) return false;
  const expected = signContactId(contactId);
  const expectedBuffer = Buffer.from(expected);
  const tokenBuffer = Buffer.from(token);
  return (
    expectedBuffer.length === tokenBuffer.length &&
    timingSafeEqual(expectedBuffer, tokenBuffer)
  );
}

export function getPublicBaseUrl(request?: Request): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  }
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  if (request) return new URL(request.url).origin;
  return "http://localhost:3015";
}

export function createUnsubscribeUrl(
  contactId: string,
  baseUrl: string,
): string {
  const normalizedBaseUrl = baseUrl.replace(/\/$/, "");
  const token = createUnsubscribeToken(contactId);
  return `${normalizedBaseUrl}/unsubscribe/${encodeURIComponent(
    contactId,
  )}?token=${encodeURIComponent(token)}`;
}

export function hasUnsubscribePlaceholder(input: string | null | undefined) {
  return input?.includes(RESEND_UNSUBSCRIBE_URL) ?? false;
}

export function replaceUnsubscribePlaceholder(
  input: string | null | undefined,
  unsubscribeUrl: string,
): string {
  return (input ?? "").split(RESEND_UNSUBSCRIBE_URL).join(unsubscribeUrl);
}

export function buildOneClickUnsubscribeHeaders(
  unsubscribeUrl: string,
): Record<string, string> {
  return {
    [LIST_UNSUBSCRIBE_HEADER]: `<${unsubscribeUrl}>`,
    [LIST_UNSUBSCRIBE_POST_HEADER]: LIST_UNSUBSCRIBE_POST_VALUE,
  };
}
