import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

const TOKEN_VERSION = "opensend.tracking.v1";
const OPEN_PIXEL_MARKER = 'data-opensend-open-tracking="true"';

export type EmailTrackingKind = "open" | "click";

export type EmailTrackingTokenPayload = {
  v: 1;
  kind: EmailTrackingKind;
  userId: string;
  emailId: string;
  domainId: string;
  recipient?: string;
  targetUrl?: string;
};

export type VerifiedEmailTrackingToken = EmailTrackingTokenPayload;

export type ApplyEmailTrackingInput = {
  html: string | null | undefined;
  clickTracking: boolean;
  openTracking: boolean;
  trackingBaseUrl: string;
  createClickToken: (targetUrl: string) => string;
  createOpenToken: () => string;
};

export type ApplyEmailTrackingResult = {
  html: string;
  rewroteLinks: number;
  insertedOpenPixel: boolean;
};

function getTrackingSecret(): string {
  const secret =
    process.env.TRACKING_SECRET ??
    process.env.UNSUBSCRIBE_SECRET ??
    process.env.BETTER_AUTH_SECRET ??
    process.env.AUTH_SECRET ??
    process.env.DASHBOARD_KEY;

  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("TRACKING_SECRET or DASHBOARD_KEY is required");
  }
  return "opensend-local-tracking-secret";
}

function signPayload(encodedPayload: string): string {
  return createHmac("sha256", getTrackingSecret())
    .update(`${TOKEN_VERSION}:${encodedPayload}`)
    .digest("base64url");
}

function getEncryptionKey(): Buffer {
  return createHash("sha256").update(getTrackingSecret()).digest();
}

function safeCompare(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function encodePayload(payload: EmailTrackingTokenPayload): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  cipher.setAAD(Buffer.from(TOKEN_VERSION));
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64url");
}

function decodePayload(encodedPayload: string): unknown {
  try {
    const blob = Buffer.from(encodedPayload, "base64url");
    if (blob.length <= 28) return null;
    const iv = blob.subarray(0, 12);
    const tag = blob.subarray(12, 28);
    const encrypted = blob.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", getEncryptionKey(), iv);
    decipher.setAAD(Buffer.from(TOKEN_VERSION));
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]).toString("utf8");
    return JSON.parse(plaintext);
  } catch {
    return null;
  }
}

function isPayloadRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizePayload(value: unknown): EmailTrackingTokenPayload | null {
  if (!isPayloadRecord(value)) return null;
  if (value.v !== 1) return null;
  if (value.kind !== "open" && value.kind !== "click") return null;
  if (typeof value.userId !== "string" || value.userId.length === 0) {
    return null;
  }
  if (typeof value.emailId !== "string" || value.emailId.length === 0) {
    return null;
  }
  if (typeof value.domainId !== "string" || value.domainId.length === 0) {
    return null;
  }

  const payload: EmailTrackingTokenPayload = {
    v: 1,
    kind: value.kind,
    userId: value.userId,
    emailId: value.emailId,
    domainId: value.domainId,
  };

  if (typeof value.recipient === "string" && value.recipient.length > 0) {
    payload.recipient = value.recipient;
  }
  if (typeof value.targetUrl === "string" && value.targetUrl.length > 0) {
    payload.targetUrl = value.targetUrl;
  }

  if (payload.kind === "click" && !isHttpUrl(payload.targetUrl)) {
    return null;
  }

  return payload;
}

export function createEmailTrackingToken(
  payload: Omit<EmailTrackingTokenPayload, "v">,
): string {
  const normalizedPayload: EmailTrackingTokenPayload = { v: 1, ...payload };
  const encodedPayload = encodePayload(normalizedPayload);
  return `${encodedPayload}.${signPayload(encodedPayload)}`;
}

export function verifyEmailTrackingToken(
  token: string | null | undefined,
): VerifiedEmailTrackingToken | null {
  if (!token) return null;
  const [encodedPayload, signature, extra] = token.split(".");
  if (!encodedPayload || !signature || extra !== undefined) return null;
  const expectedSignature = signPayload(encodedPayload);
  if (!safeCompare(signature, expectedSignature)) return null;
  return normalizePayload(decodePayload(encodedPayload));
}

export function getEmailAddressDomain(address: string): string {
  const trimmed = address.trim();
  const match = trimmed.match(/<([^<>\s]+@[^<>\s]+)>$/);
  const emailAddress = match?.[1] ?? trimmed;
  return emailAddress.split("@").pop()?.trim().toLowerCase() ?? "";
}

export function getEmailTrackingBaseUrl(input: {
  trackingSubdomain?: string | null;
  fallbackBaseUrl?: string | null;
}): string {
  const fallback =
    input.fallbackBaseUrl ??
    process.env.TRACKING_BASE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ??
    "http://localhost:3015";
  const fallbackOrigin =
    normalizeTrackingOrigin(fallback) ?? "http://localhost:3015";

  const trackingSubdomain = input.trackingSubdomain?.trim();
  if (!trackingSubdomain) return fallbackOrigin;

  return (
    normalizeTrackingOrigin(
      /^https?:\/\//i.test(trackingSubdomain)
        ? trackingSubdomain
        : `https://${trackingSubdomain}`,
    ) ?? fallbackOrigin
  );
}

function normalizeTrackingOrigin(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function applyEmailTracking(
  input: ApplyEmailTrackingInput,
): ApplyEmailTrackingResult {
  let html = input.html ?? "";
  let rewroteLinks = 0;

  if (input.clickTracking) {
    const result = rewriteHtmlLinks({
      html,
      trackingBaseUrl: input.trackingBaseUrl,
      createClickToken: input.createClickToken,
    });
    html = result.html;
    rewroteLinks = result.rewroteLinks;
  }

  let insertedOpenPixel = false;
  if (input.openTracking && !html.includes(OPEN_PIXEL_MARKER)) {
    const token = input.createOpenToken();
    html = insertOpenPixel(
      html,
      buildTrackingUrl(input.trackingBaseUrl, "open", token),
    );
    insertedOpenPixel = true;
  }

  return { html, rewroteLinks, insertedOpenPixel };
}

function rewriteHtmlLinks(input: {
  html: string;
  trackingBaseUrl: string;
  createClickToken: (targetUrl: string) => string;
}): { html: string; rewroteLinks: number } {
  let rewroteLinks = 0;
  const html = input.html.replace(
    /<a\b([^>]*?)\bhref\s*=\s*(["'])(.*?)\2([^>]*)>/gi,
    (
      fullMatch: string,
      beforeHref: string,
      quote: string,
      rawHref: string,
      afterHref: string,
    ) => {
      const href = decodeHtmlAttribute(rawHref.trim());
      if (!shouldRewriteHref(href, `${beforeHref} ${afterHref}`)) {
        return fullMatch;
      }

      const token = input.createClickToken(href);
      const trackingUrl = buildTrackingUrl(
        input.trackingBaseUrl,
        "click",
        token,
      );
      rewroteLinks++;
      return `<a${beforeHref}href=${quote}${escapeHtmlAttribute(trackingUrl)}${quote}${afterHref}>`;
    },
  );

  return { html, rewroteLinks };
}

function buildTrackingUrl(
  trackingBaseUrl: string,
  kind: EmailTrackingKind,
  token: string,
): string {
  return `${trackingBaseUrl.replace(/\/$/, "")}/api/track/${kind}/${encodeURIComponent(token)}`;
}

function shouldRewriteHref(href: string, anchorAttributes: string): boolean {
  if (!isHttpUrl(href)) return false;
  const lowerHref = href.toLowerCase();
  const lowerAttributes = anchorAttributes.toLowerCase();
  if (
    lowerHref.includes("/unsubscribe/") ||
    lowerHref.includes("unsubscribe")
  ) {
    return false;
  }
  if (lowerAttributes.includes("list-unsubscribe")) return false;
  if (lowerAttributes.includes("unsubscribe")) return false;

  try {
    const url = new URL(href);
    if (url.pathname.startsWith("/api/track/")) return false;
  } catch {
    return false;
  }

  return true;
}

function insertOpenPixel(html: string, pixelUrl: string): string {
  const pixel = `<img src="${escapeHtmlAttribute(pixelUrl)}" width="1" height="1" alt="" style="display:none!important;width:1px;height:1px;opacity:0" ${OPEN_PIXEL_MARKER} />`;
  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, `${pixel}</body>`);
  }
  return `${html}${pixel}`;
}

function isHttpUrl(value: string | undefined): value is string {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function decodeHtmlAttribute(value: string): string {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'");
}

function escapeHtmlAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
