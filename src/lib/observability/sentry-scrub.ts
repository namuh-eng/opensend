import type { ErrorEvent, EventHint } from "@sentry/nextjs";

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const SENSITIVE_HEADER_NAMES = new Set([
  "authorization",
  "cookie",
  "set-cookie",
  "x-api-key",
  "x-auth-token",
  "x-csrf-token",
  "x-forwarded-for",
]);
const SENSITIVE_QUERY_KEYS = new Set([
  "token",
  "access_token",
  "refresh_token",
  "id_token",
  "code",
  "state",
  "secret",
  "api_key",
  "apikey",
  "key",
  "signature",
  "sig",
  "password",
  "email",
]);

function redactEmails(value: string): string {
  return value.replace(EMAIL_RE, "[redacted-email]");
}

function redactUrl(url: string): string {
  try {
    const parsed = new URL(url, "http://localhost");
    for (const key of SENSITIVE_QUERY_KEYS) {
      if (parsed.searchParams.has(key)) {
        parsed.searchParams.set(key, "[redacted]");
      }
    }
    return parsed.pathname + parsed.search;
  } catch {
    return redactEmails(url);
  }
}

function redactHeaders(
  headers: Record<string, string> | undefined,
): Record<string, string> | undefined {
  if (!headers) return headers;
  const out: Record<string, string> = {};
  for (const [name, value] of Object.entries(headers)) {
    out[name] = SENSITIVE_HEADER_NAMES.has(name.toLowerCase())
      ? "[redacted]"
      : value;
  }
  return out;
}

export function scrubPiiFromEvent(
  event: ErrorEvent,
  _hint?: EventHint,
): ErrorEvent | null {
  if (event.user) {
    event.user.ip_address = undefined;
    if (event.user.email) event.user.email = "[redacted]";
  }
  if (event.request) {
    if (event.request.url) event.request.url = redactUrl(event.request.url);
    if (event.request.headers && typeof event.request.headers === "object") {
      event.request.headers = redactHeaders(
        event.request.headers as Record<string, string>,
      );
    }
    if (event.request.cookies) event.request.cookies = {};
  }
  if (event.message) {
    event.message = redactEmails(event.message);
  }
  if (event.exception?.values) {
    for (const ex of event.exception.values) {
      if (ex.value) ex.value = redactEmails(ex.value);
    }
  }
  return event;
}
