import type { AuthResult } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { logs } from "@/lib/db/schema";

type JsonPrimitive = string | number | boolean | null;
export type JsonValue =
  | JsonPrimitive
  | JsonValue[]
  | { [key: string]: JsonValue };

export interface ApiLogDocument {
  apiKeyId: string;
  emailId?: string;
  emailIds?: string[];
  correlationId?: string;
  traceparent?: string;
  [key: string]: JsonValue | undefined;
}

interface CaptureApiLogInput {
  request: Request;
  auth: AuthResult;
  status: number;
  requestBody?: unknown;
  responseBody?: unknown;
  document?: Omit<ApiLogDocument, "apiKeyId">;
}

const REDACTED = "[REDACTED]";
const MAX_STRING_LENGTH = 2_000;
const MAX_ARRAY_ITEMS = 50;
const MAX_OBJECT_KEYS = 80;
const MAX_DEPTH = 8;

const REDACTED_KEY_PATTERNS = [
  /authorization/i,
  /cookie/i,
  /api[-_]?key/i,
  /token/i,
  /secret/i,
  /password/i,
  /credential/i,
  /^html$/i,
  /^text$/i,
  /^content$/i,
  /^content_base64$/i,
];

function shouldRedactKey(key: string): boolean {
  if (key === "apiKeyId") return false;
  return REDACTED_KEY_PATTERNS.some((pattern) => pattern.test(key));
}

function truncateString(value: string): string {
  if (value.length <= MAX_STRING_LENGTH) return value;
  return `${value.slice(0, MAX_STRING_LENGTH)}…[truncated ${
    value.length - MAX_STRING_LENGTH
  } chars]`;
}

export function sanitizeLogValue(value: unknown, depth = 0): JsonValue {
  if (depth > MAX_DEPTH) return "[truncated-depth]";
  if (value == null) return null;

  const valueType = typeof value;
  if (valueType === "string") return truncateString(value as string);
  if (valueType === "number") {
    return Number.isFinite(value as number) ? (value as number) : null;
  }
  if (valueType === "boolean") return value as boolean;
  if (value instanceof Date) return value.toISOString();

  if (Array.isArray(value)) {
    const items = value
      .slice(0, MAX_ARRAY_ITEMS)
      .map((item) => sanitizeLogValue(item, depth + 1));
    if (value.length > MAX_ARRAY_ITEMS) {
      items.push(`[truncated ${value.length - MAX_ARRAY_ITEMS} items]`);
    }
    return items;
  }

  if (valueType === "object") {
    const output: { [key: string]: JsonValue } = {};
    const entries = Object.entries(value as Record<string, unknown>).slice(
      0,
      MAX_OBJECT_KEYS,
    );
    for (const [key, entryValue] of entries) {
      output[key] = shouldRedactKey(key)
        ? REDACTED
        : sanitizeLogValue(entryValue, depth + 1);
    }
    const totalKeys = Object.keys(value as Record<string, unknown>).length;
    if (totalKeys > MAX_OBJECT_KEYS) {
      output.__truncated_keys = totalKeys - MAX_OBJECT_KEYS;
    }
    return output;
  }

  return String(value);
}

export async function captureApiLog(input: CaptureApiLogInput): Promise<void> {
  if (!input.auth.userId) return;

  try {
    const url = new URL(input.request.url);
    const document: ApiLogDocument = {
      apiKeyId: input.auth.apiKeyId,
      ...input.document,
    };

    await db.insert(logs).values({
      endpoint: `${url.pathname}${url.search}`,
      status: input.status,
      method: input.request.method.toUpperCase(),
      userAgent: input.request.headers.get("user-agent"),
      requestBody:
        input.requestBody === undefined
          ? null
          : sanitizeLogValue(input.requestBody),
      responseBody:
        input.responseBody === undefined
          ? null
          : sanitizeLogValue(input.responseBody),
      document: sanitizeLogValue(document),
      userId: input.auth.userId,
      apiKeyId: input.auth.apiKeyId,
    });
  } catch (error) {
    console.error("Failed to capture API request log:", error);
  }
}

export async function captureApiResponseLog(
  input: Omit<CaptureApiLogInput, "status" | "responseBody"> & {
    response: Response;
  },
): Promise<Response> {
  const responseBody = await readResponseBody(input.response);
  await captureApiLog({
    ...input,
    status: input.response.status,
    responseBody,
  });
  return input.response;
}

async function readResponseBody(response: Response): Promise<unknown> {
  try {
    const text = await response.clone().text();
    if (!text) return null;
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return text;
    }
  } catch {
    return null;
  }
}
