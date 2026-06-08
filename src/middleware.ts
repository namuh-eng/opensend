import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";

type RateCheckResult =
  | { allowed: true }
  | { allowed: false; retryAfter: number; status: 429 }
  | { allowed: false; error: string; status: 503 };

type RateLimitBackend = "disabled" | "redis";
type RateLimitDependencies = typeof import("@/lib/cache/redis");

const RATE_LIMIT_BACKEND_UNAVAILABLE_ERROR =
  "Rate limiting is temporarily unavailable.";
let hasLoggedRateLimitConfigError = false;
let hasLoggedUnsupportedRateLimitBackend = false;

function getRateLimitBackend(): RateLimitBackend {
  const backend = process.env.RATE_LIMIT_BACKEND?.trim().toLowerCase();
  if (!backend) return "disabled";
  if (backend === "disabled" || backend === "redis") return backend;

  if (!hasLoggedUnsupportedRateLimitBackend) {
    hasLoggedUnsupportedRateLimitBackend = true;
    console.warn(
      `[rate-limit] Unsupported RATE_LIMIT_BACKEND="${backend}". Falling back to "disabled".`,
    );
  }
  return "disabled";
}

async function checkRate(
  key: string,
  maxRequests: number,
  windowMs: number,
  rateLimit: RateLimitDependencies,
): Promise<RateCheckResult> {
  if (!rateLimit.isRedisConfigured()) {
    if (!hasLoggedRateLimitConfigError) {
      hasLoggedRateLimitConfigError = true;
      console.error(
        "[rate-limit] RATE_LIMIT_BACKEND=redis requires REDIS_URL to be set.",
      );
    }
    return {
      allowed: false,
      error: RATE_LIMIT_BACKEND_UNAVAILABLE_ERROR,
      status: 503,
    };
  }

  const redisKey = `ratelimit:${key}`;
  const windowSeconds = Math.ceil(windowMs / 1000);
  const count = await rateLimit.incrCache(redisKey, windowSeconds);

  if (count === null) {
    return {
      allowed: false,
      error: RATE_LIMIT_BACKEND_UNAVAILABLE_ERROR,
      status: 503,
    };
  }

  if (count <= maxRequests) {
    return { allowed: true };
  }

  const ttl = await rateLimit.getTtl(redisKey);
  return {
    allowed: false,
    retryAfter: ttl && ttl > 0 ? ttl : windowSeconds,
    status: 429,
  };
}

function getTrustedProxyHops(): number {
  const raw = process.env.TRUSTED_PROXY_HOPS;
  const n = raw ? Number.parseInt(raw, 10) : 0;
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/**
 * Resolves the client IP from `x-forwarded-for`.
 *
 * XFF is a comma-separated list; right-most entries are appended by trusted
 * proxies. Reading the left-most entry trusts whatever the original client
 * sent — easy to spoof for rate-limit evasion. We instead select the entry
 * `TRUSTED_PROXY_HOPS` from the right (0 = direct connection, 1 = one proxy,
 * etc.), falling back to `x-real-ip`. Operators must set
 * `TRUSTED_PROXY_HOPS` to match their deploy topology.
 */
export function extractClientIp(request: NextRequest): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const parts = xff
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length > 0) {
      const hops = getTrustedProxyHops();
      const idx = Math.max(0, parts.length - 1 - hops);
      const candidate = parts[idx];
      if (candidate) return candidate;
    }
  }
  return request.headers.get("x-real-ip")?.trim() ?? "";
}

// Rate limit tiers by route pattern
function isSingleSendPostAlias(pathname: string, method: string): boolean {
  return pathname === "/emails" && method === "POST";
}

function isBatchSendPostAlias(pathname: string, method: string): boolean {
  return pathname === "/emails/batch" && method === "POST";
}

function isSendPostAlias(pathname: string, method: string): boolean {
  return (
    isSingleSendPostAlias(pathname, method) ||
    isBatchSendPostAlias(pathname, method)
  );
}

function isEmailCancelAlias(pathname: string, method: string): boolean {
  if (method !== "POST") return false;

  const parts = pathname.split("/").filter(Boolean);
  return parts[0] === "emails" && parts.length === 3 && parts[2] === "cancel";
}

function isContactRelationshipAlias(pathname: string, method: string): boolean {
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] !== "contacts") return false;
  if (parts.length === 3 && parts[2] === "segments") return method === "GET";
  if (parts.length === 4 && parts[2] === "segments") {
    return ["POST", "DELETE"].includes(method);
  }
  if (parts.length === 3 && parts[2] === "topics") {
    return ["GET", "PATCH"].includes(method);
  }

  return false;
}

function isContactsAlias(pathname: string, method: string): boolean {
  if (pathname === "/contacts") return ["GET", "POST"].includes(method);

  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] !== "contacts") return false;
  if (parts.length === 2) return ["GET", "PATCH", "DELETE"].includes(method);
  return isContactRelationshipAlias(pathname, method);
}

function isAudiencesAlias(pathname: string, method: string): boolean {
  if (pathname === "/audiences") return ["GET", "POST"].includes(method);
  if (pathname.startsWith("/audiences/")) {
    return ["GET", "DELETE"].includes(method);
  }
  return false;
}

function isSegmentsAlias(pathname: string, method: string): boolean {
  if (pathname === "/segments") return ["GET", "POST"].includes(method);

  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] !== "segments") return false;
  if (parts.length === 2) return ["GET", "DELETE"].includes(method);
  if (parts.length === 3 && parts[2] === "contacts") return method === "GET";

  return false;
}

function isBroadcastsAlias(pathname: string, method: string): boolean {
  if (pathname === "/broadcasts") return ["GET", "POST"].includes(method);
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] !== "broadcasts") return false;
  if (parts.length === 2) {
    return ["GET", "PATCH", "DELETE"].includes(method);
  }
  if (parts.length === 3 && parts[2] === "send") {
    return method === "POST";
  }
  return false;
}

function isApiKeysAlias(pathname: string, method: string): boolean {
  if (pathname === "/api-keys") return ["GET", "POST"].includes(method);

  const parts = pathname.split("/").filter(Boolean);
  return parts[0] === "api-keys" && parts.length === 2 && method === "DELETE";
}

function isTemplatesAlias(pathname: string, method: string): boolean {
  if (pathname === "/templates") return ["GET", "POST"].includes(method);

  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] !== "templates") return false;
  if (parts.length === 2) return ["GET", "PATCH", "DELETE"].includes(method);
  if (parts.length === 3 && ["publish", "duplicate"].includes(parts[2] ?? "")) {
    return method === "POST";
  }

  return false;
}

function isTemplateGetAlias(pathname: string, method: string): boolean {
  if (method !== "GET") return false;
  if (pathname === "/templates") return true;

  const parts = pathname.split("/").filter(Boolean);
  return parts[0] === "templates" && parts.length === 2;
}

function isBroadcastsCollectionAlias(
  pathname: string,
  method: string,
): boolean {
  return pathname === "/broadcasts" && ["GET", "POST"].includes(method);
}

function isApiLikeRequest(request: NextRequest): boolean {
  const accept = request.headers.get("accept") ?? "";
  const contentType = request.headers.get("content-type") ?? "";

  if (
    accept.includes("text/html") ||
    request.headers.has("rsc") ||
    request.headers.has("next-router-state-tree") ||
    request.headers.has("next-url") ||
    request.headers.get("sec-fetch-dest") === "document"
  ) {
    return false;
  }

  // Root GET aliases that collide with dashboard pages are intentionally
  // narrower than detail/mutation aliases: ambiguous browser/RSC navigations can
  // send Accept: */*, so require an explicit API signal before rewriting.
  return (
    request.headers.has("authorization") ||
    accept.includes("application/json") ||
    contentType.includes("application/json")
  );
}

function shouldHandleBroadcastsAlias(request: NextRequest): boolean {
  const { pathname } = request.nextUrl;
  if (!isBroadcastsAlias(pathname, request.method)) return false;
  if (pathname === "/broadcasts" && request.method === "GET") {
    return isApiLikeRequest(request);
  }
  return true;
}

function shouldHandleApiKeysAlias(request: NextRequest): boolean {
  const { pathname } = request.nextUrl;
  if (!isApiKeysAlias(pathname, request.method)) return false;
  if (pathname === "/api-keys" && request.method === "GET") {
    return isApiLikeRequest(request);
  }
  return true;
}

function shouldHandleTemplatesAlias(request: NextRequest): boolean {
  const { pathname } = request.nextUrl;
  if (!isTemplatesAlias(pathname, request.method)) return false;
  if (isTemplateGetAlias(pathname, request.method)) {
    return isApiLikeRequest(request);
  }
  return true;
}

function isDomainsAlias(pathname: string, method: string): boolean {
  if (pathname === "/domains") return ["GET", "POST"].includes(method);

  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] !== "domains") return false;
  if (parts.length === 2) return ["GET", "PATCH", "DELETE"].includes(method);
  if (parts.length === 3 && parts[2] === "verify") return method === "POST";

  return false;
}

function isWebhooksAlias(pathname: string, method: string): boolean {
  if (pathname === "/webhooks") return ["GET", "POST"].includes(method);

  const parts = pathname.split("/").filter(Boolean);
  return (
    parts[0] === "webhooks" &&
    parts.length === 2 &&
    ["GET", "PATCH", "DELETE"].includes(method)
  );
}

function isTopicsAlias(pathname: string, method: string): boolean {
  if (pathname === "/topics") return ["GET", "POST"].includes(method);

  const parts = pathname.split("/").filter(Boolean);
  return (
    parts[0] === "topics" &&
    parts.length === 2 &&
    ["GET", "PATCH", "DELETE"].includes(method)
  );
}

function isLogsAlias(pathname: string, method: string): boolean {
  if (pathname === "/logs") return method === "GET";

  const parts = pathname.split("/").filter(Boolean);
  return parts[0] === "logs" && parts.length === 2 && method === "GET";
}

function isEventsAlias(pathname: string, method: string): boolean {
  if (pathname === "/events") return ["GET", "POST"].includes(method);

  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] !== "events") return false;
  if (parts.length === 2 && parts[1] === "send") return method === "POST";
  if (parts.length === 2) return ["GET", "PATCH", "DELETE"].includes(method);

  return false;
}

function isContactPropertiesAlias(pathname: string, method: string): boolean {
  if (pathname === "/contact-properties") {
    return ["GET", "POST"].includes(method);
  }

  const parts = pathname.split("/").filter(Boolean);
  return (
    parts[0] === "contact-properties" &&
    parts.length === 2 &&
    ["GET", "PATCH", "DELETE"].includes(method)
  );
}

function isEmailReadAlias(pathname: string, method: string): boolean {
  if (pathname === "/emails") return method === "GET";

  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] !== "emails") return false;
  if (parts.length === 2) return ["GET", "PATCH"].includes(method);
  if (
    parts.length === 3 &&
    ["attachments", "events", "trace"].includes(parts[2] ?? "")
  ) {
    return method === "GET";
  }
  if (parts.length === 4 && parts[2] === "attachments") return method === "GET";
  if (parts[1] === "receiving") {
    if (parts.length === 2) return method === "GET";
    if (parts.length === 3) return method === "GET";
    if (parts.length === 4 && parts[3] === "attachments")
      return method === "GET";
    if (parts.length === 5 && parts[3] === "attachments")
      return method === "GET";
  }

  return false;
}

function shouldHandleApiCompatibilityAlias(request: NextRequest): boolean {
  const { pathname } = request.nextUrl;
  const method = request.method;

  const isAlias =
    isDomainsAlias(pathname, method) ||
    isWebhooksAlias(pathname, method) ||
    isTopicsAlias(pathname, method) ||
    isLogsAlias(pathname, method) ||
    isEventsAlias(pathname, method) ||
    isContactPropertiesAlias(pathname, method) ||
    isEmailReadAlias(pathname, method);

  if (!isAlias) return false;
  if (method === "GET") return isApiLikeRequest(request);
  return true;
}

function toPublicTemplatesPath(pathname: string): string {
  return pathname === "/templates"
    ? "/api/public/templates"
    : pathname.replace(/^\/templates/, "/api/public/templates");
}

function toApiKeysPath(pathname: string): string {
  return pathname === "/api-keys"
    ? "/api/api-keys"
    : pathname.replace(/^\/api-keys/, "/api/api-keys");
}

function toContactsApiPath(pathname: string): string {
  return pathname === "/contacts"
    ? "/api/contacts"
    : pathname.replace(/^\/contacts/, "/api/contacts");
}

function toApiCompatibilityPath(pathname: string): string {
  if (pathname === "/domains") return "/api/domains";
  if (pathname.startsWith("/domains/")) {
    return pathname.replace(/^\/domains/, "/api/domains");
  }
  if (pathname === "/webhooks") return "/api/webhooks";
  if (pathname.startsWith("/webhooks/")) {
    return pathname.replace(/^\/webhooks/, "/api/webhooks");
  }
  if (pathname === "/topics") return "/api/topics";
  if (pathname.startsWith("/topics/")) {
    return pathname.replace(/^\/topics/, "/api/topics");
  }
  if (pathname === "/logs") return "/api/logs";
  if (pathname.startsWith("/logs/")) {
    return pathname.replace(/^\/logs/, "/api/logs");
  }
  if (pathname === "/events") return "/api/events";
  if (pathname.startsWith("/events/")) {
    return pathname.replace(/^\/events/, "/api/events");
  }
  if (pathname === "/contact-properties") return "/api/properties";
  if (pathname.startsWith("/contact-properties/")) {
    return pathname.replace(/^\/contact-properties/, "/api/properties");
  }
  if (pathname === "/emails") return "/api/emails";
  if (pathname.startsWith("/emails/")) {
    return pathname.replace(/^\/emails/, "/api/emails");
  }

  return pathname;
}

function isSendApiPost(pathname: string, method: string): boolean {
  return (
    method === "POST" &&
    (pathname === "/api/emails" ||
      pathname === "/api/emails/batch" ||
      pathname === "/emails" ||
      pathname === "/emails/batch")
  );
}

function getRateLimitPathname(pathname: string, method: string): string {
  if (isSingleSendPostAlias(pathname, method)) return "/api/emails";
  if (isBatchSendPostAlias(pathname, method)) return "/api/emails/batch";
  if (isEmailCancelAlias(pathname, method)) {
    return pathname.replace(/^\/emails/, "/api/emails");
  }
  if (isContactsAlias(pathname, method)) {
    return pathname === "/contacts"
      ? "/api/contacts"
      : pathname.replace(/^\/contacts/, "/api/contacts");
  }
  if (isAudiencesAlias(pathname, method)) {
    return pathname === "/audiences"
      ? "/api/segments"
      : pathname.replace(/^\/audiences/, "/api/segments");
  }
  if (isSegmentsAlias(pathname, method)) {
    return pathname === "/segments"
      ? "/api/segments"
      : pathname.replace(/^\/segments/, "/api/segments");
  }
  if (isBroadcastsAlias(pathname, method)) {
    return pathname === "/broadcasts"
      ? "/api/broadcasts"
      : pathname.replace(/^\/broadcasts/, "/api/broadcasts");
  }
  if (isApiKeysAlias(pathname, method)) {
    return toApiKeysPath(pathname);
  }
  if (isTemplatesAlias(pathname, method)) {
    return pathname === "/templates"
      ? "/api/templates"
      : pathname.replace(/^\/templates/, "/api/templates");
  }
  if (
    isDomainsAlias(pathname, method) ||
    isWebhooksAlias(pathname, method) ||
    isTopicsAlias(pathname, method) ||
    isLogsAlias(pathname, method) ||
    isEventsAlias(pathname, method) ||
    isContactPropertiesAlias(pathname, method) ||
    isEmailReadAlias(pathname, method)
  ) {
    return toApiCompatibilityPath(pathname);
  }
  return pathname;
}

function getLimits(
  pathname: string,
  method: string,
): { max: number; windowMs: number } {
  // Email sending — strictest limit
  if (
    (pathname === "/api/emails" || pathname === "/emails") &&
    method === "POST"
  ) {
    return { max: 20, windowMs: 60_000 };
  }
  if (
    (pathname === "/api/emails/batch" || pathname === "/emails/batch") &&
    method === "POST"
  ) {
    return { max: 5, windowMs: 60_000 };
  }
  // API key management — tight limit
  if (
    (pathname.startsWith("/api/api-keys") ||
      pathname === "/api-keys" ||
      pathname.startsWith("/api-keys/")) &&
    method !== "GET"
  ) {
    return { max: 10, windowMs: 60_000 };
  }
  // Domain operations
  if (pathname.startsWith("/api/domains") && method === "POST") {
    return { max: 10, windowMs: 60_000 };
  }
  // Auth verify — prevent brute force
  if (pathname === "/api/auth/verify") {
    return { max: 10, windowMs: 60_000 };
  }
  // All other write operations — general limit
  if (method !== "GET") {
    return { max: 30, windowMs: 60_000 };
  }
  // GET requests — generous limit
  return { max: 100, windowMs: 60_000 };
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublicUnsubscribeRoute = pathname.startsWith("/unsubscribe/");
  const isDevReceivingPreviewRoute =
    process.env.NODE_ENV !== "production" &&
    pathname === "/dev/receiving-preview";

  // Protect non-API page routes with session check. Resend-compatible send
  // aliases must bypass dashboard session redirects and use public API auth.
  const isSendAlias = isSendPostAlias(pathname, request.method);
  const isEmailCancel = isEmailCancelAlias(pathname, request.method);
  const isContactAlias = isContactsAlias(pathname, request.method);
  const isAudienceAlias = isAudiencesAlias(pathname, request.method);
  const isSegmentAlias = isSegmentsAlias(pathname, request.method);
  const isBroadcastAlias = shouldHandleBroadcastsAlias(request);
  const isApiKeyAlias = shouldHandleApiKeysAlias(request);
  const isTemplateAlias = shouldHandleTemplatesAlias(request);
  const isApiCompatibilityAlias = shouldHandleApiCompatibilityAlias(request);
  if (
    !pathname.startsWith("/api/") &&
    !isSendAlias &&
    !isEmailCancel &&
    !isContactAlias &&
    !isAudienceAlias &&
    !isSegmentAlias &&
    !isBroadcastAlias &&
    !isApiKeyAlias &&
    !isTemplateAlias &&
    !isApiCompatibilityAlias
  ) {
    // Logged-in users should never see the sign-in page — bounce them to the
    // dashboard, mirroring the authenticated redirect on `/` (src/app/page.tsx).
    if (pathname === "/auth" && getSessionCookie(request)) {
      return NextResponse.redirect(new URL("/today", request.url));
    }

    // Allow auth page, public landing page, and static assets
    if (
      pathname === "/" ||
      pathname === "/auth" ||
      pathname === "/docs" ||
      pathname.startsWith("/docs/") ||
      pathname === "/llms.txt" ||
      pathname === "/openapi.json" ||
      pathname === "/landing" ||
      pathname.startsWith("/landing/") ||
      pathname === "/pricing" ||
      pathname.startsWith("/pricing/") ||
      pathname === "/status" ||
      isDevReceivingPreviewRoute ||
      pathname.startsWith("/_next/") ||
      pathname.startsWith("/favicon")
    ) {
      return NextResponse.next();
    }
    if (isPublicUnsubscribeRoute) {
      // Public one-click links must not require auth, but still flow through
      // the same anonymous IP rate-limit path used for API routes below.
    } else {
      const sessionCookie = getSessionCookie(request);
      if (!sessionCookie) {
        return NextResponse.redirect(new URL("/auth", request.url));
      }
      return NextResponse.next();
    }
  }

  const backend = getRateLimitBackend();
  const responseHeaders = new Headers({ "X-RateLimit-Backend": backend });

  if (backend === "disabled") {
    if (isSingleSendPostAlias(pathname, request.method)) {
      return NextResponse.rewrite(new URL("/api/emails", request.url), {
        headers: responseHeaders,
      });
    }
    if (isBatchSendPostAlias(pathname, request.method)) {
      return NextResponse.rewrite(new URL("/api/emails/batch", request.url), {
        headers: responseHeaders,
      });
    }
    if (isBroadcastsCollectionAlias(pathname, request.method)) {
      return NextResponse.rewrite(new URL("/api/broadcasts", request.url), {
        headers: responseHeaders,
      });
    }
    if (isApiKeyAlias) {
      return NextResponse.rewrite(
        new URL(toApiKeysPath(pathname), request.url),
        {
          headers: responseHeaders,
        },
      );
    }
    if (isTemplateAlias) {
      return NextResponse.rewrite(
        new URL(toPublicTemplatesPath(pathname), request.url),
        { headers: responseHeaders },
      );
    }
    if (isContactRelationshipAlias(pathname, request.method)) {
      return NextResponse.rewrite(
        new URL(toContactsApiPath(pathname), request.url),
        {
          headers: responseHeaders,
        },
      );
    }
    if (isApiCompatibilityAlias) {
      return NextResponse.rewrite(
        new URL(toApiCompatibilityPath(pathname), request.url),
        { headers: responseHeaders },
      );
    }

    return NextResponse.next({ headers: responseHeaders });
  }

  const rateLimit = await import("@/lib/cache/redis");

  const rawIp = extractClientIp(request);
  const ip = /^[\d.a-fA-F:]+$/.test(rawIp) ? rawIp : "unknown";
  const authKey = request.headers.get("authorization")?.slice(0, 20) ?? "anon";
  const rateLimitPathname = getRateLimitPathname(pathname, request.method);
  const rateLimitKey = `${ip}:${authKey}:${rateLimitPathname}`;

  const { max, windowMs } = getLimits(rateLimitPathname, request.method);
  const result = await checkRate(rateLimitKey, max, windowMs, rateLimit);

  if (!result.allowed) {
    const message =
      result.status === 429
        ? "Rate limit exceeded. Try again later."
        : result.error;
    const headers = new Headers({ "X-RateLimit-Backend": backend });
    if (result.status === 429) {
      headers.set("Retry-After", String(result.retryAfter));
    }

    if (isSendApiPost(pathname, request.method)) {
      const code =
        result.status === 429
          ? "rate_limit_exceeded"
          : "rate_limit_unavailable";
      return NextResponse.json(
        {
          name: code,
          code,
          message,
          statusCode: result.status,
        },
        { status: result.status, headers },
      );
    }

    return NextResponse.json(
      { error: message },
      { status: result.status, headers },
    );
  }

  if (isSingleSendPostAlias(pathname, request.method)) {
    return NextResponse.rewrite(new URL("/api/emails", request.url), {
      headers: responseHeaders,
    });
  }
  if (isBatchSendPostAlias(pathname, request.method)) {
    return NextResponse.rewrite(new URL("/api/emails/batch", request.url), {
      headers: responseHeaders,
    });
  }
  if (isBroadcastsCollectionAlias(pathname, request.method)) {
    return NextResponse.rewrite(new URL("/api/broadcasts", request.url), {
      headers: responseHeaders,
    });
  }
  if (isApiKeyAlias) {
    return NextResponse.rewrite(new URL(toApiKeysPath(pathname), request.url), {
      headers: responseHeaders,
    });
  }
  if (isTemplateAlias) {
    return NextResponse.rewrite(
      new URL(toPublicTemplatesPath(pathname), request.url),
      { headers: responseHeaders },
    );
  }
  if (isContactRelationshipAlias(pathname, request.method)) {
    return NextResponse.rewrite(
      new URL(toContactsApiPath(pathname), request.url),
      {
        headers: responseHeaders,
      },
    );
  }
  if (isApiCompatibilityAlias) {
    return NextResponse.rewrite(
      new URL(toApiCompatibilityPath(pathname), request.url),
      { headers: responseHeaders },
    );
  }

  return NextResponse.next({ headers: responseHeaders });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
  runtime: "nodejs",
};
