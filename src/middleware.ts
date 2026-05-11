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

function isContactsAlias(pathname: string, method: string): boolean {
  if (pathname === "/contacts") return ["GET", "POST"].includes(method);
  if (pathname.startsWith("/contacts/")) {
    return ["GET", "PATCH", "DELETE"].includes(method);
  }
  return false;
}

function isAudiencesAlias(pathname: string, method: string): boolean {
  if (pathname === "/audiences") return ["GET", "POST"].includes(method);
  if (pathname.startsWith("/audiences/")) {
    return ["GET", "DELETE"].includes(method);
  }
  return false;
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
  if (pathname.startsWith("/api/api-keys") && method !== "GET") {
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

  // Protect non-API page routes with session check. Resend-compatible send
  // aliases must bypass dashboard session redirects and use public API auth.
  const isSendAlias = isSendPostAlias(pathname, request.method);
  const isContactAlias = isContactsAlias(pathname, request.method);
  const isAudienceAlias = isAudiencesAlias(pathname, request.method);
  if (
    !pathname.startsWith("/api/") &&
    !isSendAlias &&
    !isContactAlias &&
    !isAudienceAlias
  ) {
    // Allow auth page, public landing page, and static assets
    if (
      pathname === "/" ||
      pathname === "/auth" ||
      pathname === "/docs" ||
      pathname === "/openapi.json" ||
      pathname === "/landing" ||
      pathname.startsWith("/landing/") ||
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

    return NextResponse.next({ headers: responseHeaders });
  }

  const rateLimit = await import("@/lib/cache/redis");

  const rawIp =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
  const ip = /^[\d.a-fA-F:]+$/.test(rawIp) ? rawIp : "unknown";
  const authKey = request.headers.get("authorization")?.slice(0, 20) ?? "anon";
  const rateLimitPathname = getRateLimitPathname(pathname, request.method);
  const rateLimitKey = `${ip}:${authKey}:${rateLimitPathname}`;

  const { max, windowMs } = getLimits(pathname, request.method);
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

  return NextResponse.next({ headers: responseHeaders });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
  runtime: "nodejs",
};
