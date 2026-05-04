import { createHash, randomBytes } from "node:crypto";

const TRACE_ID_BYTES = 16;
const SPAN_ID_BYTES = 8;
const TRACE_FLAGS_SAMPLED = "01";
const TRACEPARENT_VERSION = "00";
const DEFAULT_NAMESPACE = "Opensend";
const MAX_SANITIZE_DEPTH = 4;

const TRACEPARENT_PATTERN =
  /^([\da-f]{2})-([\da-f]{32})-([\da-f]{16})-([\da-f]{2})$/i;
const ZERO_TRACE_ID = "0".repeat(32);
const ZERO_SPAN_ID = "0".repeat(16);
const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

const SENSITIVE_KEYS = new Set([
  "authorization",
  "cookie",
  "set-cookie",
  "token",
  "apikey",
  "api_key",
  "rawkey",
  "secret",
  "password",
  "from",
  "to",
  "cc",
  "bcc",
  "replyto",
  "reply_to",
  "subject",
  "html",
  "text",
  "body",
  "requestbody",
  "responsebody",
  "headers",
  "attachments",
  "content",
]);

export type TelemetryLevel = "info" | "warn" | "error";

export type MetricUnit =
  | "Count"
  | "Milliseconds"
  | "Seconds"
  | "Microseconds"
  | "Bytes"
  | "None";

export interface TelemetryCarrier {
  traceparent: string;
  tracestate?: string;
  correlationId: string;
}

export interface TelemetryContext extends TelemetryCarrier {
  service: string;
  operation: string;
  traceId: string;
  spanId: string;
  parentSpanId: string | null;
  sampled: boolean;
}

export interface TelemetryMetric {
  name: string;
  value: number;
  unit: MetricUnit;
}

export interface TelemetrySpanResult {
  context: TelemetryContext;
  startedAt: number;
}

export type TelemetryFields = Record<string, unknown>;
export type TelemetryDimensions = Record<string, string>;

type HeaderLike = Headers | Record<string, string | null | undefined>;

function nowIso(): string {
  return new Date().toISOString();
}

function randomHex(bytes: number): string {
  return randomBytes(bytes).toString("hex");
}

function hashValue(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

function getHeader(
  headers: HeaderLike | undefined,
  key: string,
): string | null {
  if (!headers) return null;

  if ("get" in headers && typeof headers.get === "function") {
    return headers.get(key);
  }

  const lowerKey = key.toLowerCase();
  for (const [headerKey, value] of Object.entries(headers)) {
    if (headerKey.toLowerCase() === lowerKey) return value ?? null;
  }
  return null;
}

function parseTraceparent(
  traceparent: string | null | undefined,
): Pick<TelemetryContext, "traceId" | "parentSpanId" | "sampled"> | null {
  if (!traceparent) return null;

  const match = TRACEPARENT_PATTERN.exec(traceparent.trim());
  if (!match) return null;

  const [, version, traceId, spanId, flags] = match;
  if (!version || !traceId || !spanId || !flags) return null;
  if (version.toLowerCase() !== TRACEPARENT_VERSION) return null;
  if (traceId === ZERO_TRACE_ID || spanId === ZERO_SPAN_ID) return null;

  return {
    traceId: traceId.toLowerCase(),
    parentSpanId: spanId.toLowerCase(),
    sampled: (Number.parseInt(flags, 16) & 1) === 1,
  };
}

function buildTraceparent(
  traceId: string,
  spanId: string,
  sampled: boolean,
): string {
  return `${TRACEPARENT_VERSION}-${traceId}-${spanId}-${sampled ? TRACE_FLAGS_SAMPLED : "00"}`;
}

function normalizeCorrelationId(value: string | null | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) return randomHex(8);
  return trimmed.slice(0, 128);
}

export function createTelemetryContext(input: {
  service: string;
  operation: string;
  headers?: HeaderLike;
  carrier?: Partial<TelemetryCarrier>;
  correlationId?: string | null;
}): TelemetryContext {
  const incomingTraceparent =
    input.carrier?.traceparent ?? getHeader(input.headers, "traceparent");
  const parsed = parseTraceparent(incomingTraceparent);
  const traceId = parsed?.traceId ?? randomHex(TRACE_ID_BYTES);
  const spanId = randomHex(SPAN_ID_BYTES);
  const sampled = parsed?.sampled ?? true;
  const tracestate =
    input.carrier?.tracestate ??
    getHeader(input.headers, "tracestate") ??
    undefined;
  const correlationId = normalizeCorrelationId(
    input.correlationId ??
      input.carrier?.correlationId ??
      getHeader(input.headers, "x-correlation-id") ??
      traceId,
  );

  return {
    service: input.service,
    operation: input.operation,
    traceId,
    spanId,
    parentSpanId: parsed?.parentSpanId ?? null,
    sampled,
    traceparent: buildTraceparent(traceId, spanId, sampled),
    ...(tracestate ? { tracestate } : {}),
    correlationId,
  };
}

export function createChildTelemetryContext(
  parent: TelemetryContext | TelemetryCarrier,
  input: { service?: string; operation: string },
): TelemetryContext {
  const parsed = parseTraceparent(parent.traceparent);
  const traceId = parsed?.traceId ?? randomHex(TRACE_ID_BYTES);
  const parentSpanId = parsed?.parentSpanId ?? null;
  const spanId = randomHex(SPAN_ID_BYTES);
  const sampled = parsed?.sampled ?? true;

  return {
    service:
      "service" in parent ? parent.service : (input.service ?? "unknown"),
    operation: input.operation,
    traceId,
    spanId,
    parentSpanId,
    sampled,
    traceparent: buildTraceparent(traceId, spanId, sampled),
    ...(parent.tracestate ? { tracestate: parent.tracestate } : {}),
    correlationId: parent.correlationId,
  };
}

export function getTelemetryCarrier(
  context: TelemetryContext,
): TelemetryCarrier {
  return {
    traceparent: context.traceparent,
    ...(context.tracestate ? { tracestate: context.tracestate } : {}),
    correlationId: context.correlationId,
  };
}

export function startTelemetrySpan(
  parent: TelemetryContext | TelemetryCarrier,
  input: { service?: string; operation: string; attributes?: TelemetryFields },
): TelemetrySpanResult {
  const context = createChildTelemetryContext(parent, input);
  const startedAt = performance.now();
  logTelemetry("info", "span.start", context, input.attributes ?? {});
  return { context, startedAt };
}

export function finishTelemetrySpan(
  span: TelemetrySpanResult,
  input: {
    status?: "ok" | "error" | "skipped";
    attributes?: TelemetryFields;
  } = {},
): number {
  const durationMs = performance.now() - span.startedAt;
  logTelemetry("info", "span.end", span.context, {
    status: input.status ?? "ok",
    duration_ms: Math.round(durationMs),
    ...(input.attributes ?? {}),
  });
  return durationMs;
}

export function recordTelemetryError(
  context: TelemetryContext | TelemetryCarrier,
  event: string,
  error: unknown,
  fields: TelemetryFields = {},
): void {
  logTelemetry("error", event, context, {
    ...fields,
    error_name: error instanceof Error ? error.name : "Error",
    error_message: error instanceof Error ? error.message : String(error),
  });
}

export function logTelemetry(
  level: TelemetryLevel,
  event: string,
  context: TelemetryContext | TelemetryCarrier,
  fields: TelemetryFields = {},
): void {
  const entry = sanitizeTelemetryFields({
    timestamp: nowIso(),
    level,
    event,
    service: "service" in context ? context.service : undefined,
    operation: "operation" in context ? context.operation : undefined,
    trace_id:
      "traceId" in context
        ? context.traceId
        : parseTraceparent(context.traceparent)?.traceId,
    span_id:
      "spanId" in context
        ? context.spanId
        : parseTraceparent(context.traceparent)?.parentSpanId,
    parent_span_id:
      "parentSpanId" in context ? context.parentSpanId : undefined,
    traceparent: context.traceparent,
    tracestate: context.tracestate,
    correlation_id: context.correlationId,
    ...fields,
  });

  const line = JSON.stringify(entry);
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.info(line);
  }
}

export function emitCloudWatchMetric(
  context: TelemetryContext | TelemetryCarrier,
  input: {
    namespace?: string;
    metrics: TelemetryMetric[];
    dimensions: TelemetryDimensions;
    fields?: TelemetryFields;
  },
): void {
  if (input.metrics.length === 0) return;

  const dimensions = sanitizeDimensions(input.dimensions);
  const metricValues = Object.fromEntries(
    input.metrics.map((metric) => [metric.name, metric.value]),
  );
  const metricDefinitions = input.metrics.map((metric) => ({
    Name: metric.name,
    Unit: metric.unit,
    StorageResolution: 60,
  }));

  logTelemetry("info", "metric.emf", context, {
    _aws: {
      Timestamp: Date.now(),
      CloudWatchMetrics: [
        {
          Namespace:
            input.namespace ??
            process.env.CLOUDWATCH_METRICS_NAMESPACE?.trim() ??
            DEFAULT_NAMESPACE,
          Dimensions: [Object.keys(dimensions)],
          Metrics: metricDefinitions,
        },
      ],
    },
    ...dimensions,
    ...metricValues,
    ...(input.fields ?? {}),
  });
}

function sanitizeDimensions(
  dimensions: TelemetryDimensions,
): TelemetryDimensions {
  const sanitized: TelemetryDimensions = {};
  for (const [key, value] of Object.entries(dimensions)) {
    if (!key || !value) continue;
    sanitized[key] = value.slice(0, 128);
  }
  return sanitized;
}

export function sanitizeTelemetryFields(value: unknown): unknown {
  return sanitizeValue(value, 0, null);
}

function sanitizeValue(
  value: unknown,
  depth: number,
  key: string | null,
): unknown {
  if (depth > MAX_SANITIZE_DEPTH) return "[redacted:depth]";
  if (value == null) return value;

  if (typeof value === "string") {
    if (key && isSensitiveKey(key)) return redactString(value);
    return redactEmails(value);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    if (key && isSensitiveKey(key)) return `[redacted:array:${value.length}]`;
    return value.map((item) => sanitizeValue(item, depth + 1, key));
  }

  if (typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [childKey, childValue] of Object.entries(value)) {
      if (childKey === "_aws") {
        output[childKey] = childValue;
      } else if (isSensitiveKey(childKey)) {
        output[childKey] = summarizeRedacted(childValue);
      } else {
        output[childKey] = sanitizeValue(childValue, depth + 1, childKey);
      }
    }
    return output;
  }

  return String(value);
}

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEYS.has(key.toLowerCase());
}

function summarizeRedacted(value: unknown): string {
  if (typeof value === "string") return redactString(value);
  if (Array.isArray(value)) return `[redacted:array:${value.length}]`;
  if (value && typeof value === "object") return "[redacted:object]";
  if (value == null) return "[redacted:null]";
  return "[redacted]";
}

function redactString(value: string): string {
  return `[redacted:sha256:${hashValue(value)}]`;
}

function redactEmails(value: string): string {
  return value.replace(EMAIL_PATTERN, (match) => redactString(match));
}
