import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createChildTelemetryContext,
  createTelemetryContext,
  emitCloudWatchMetric,
  sanitizeTelemetryFields,
} from "../packages/core/src/observability/telemetry";

describe("observability telemetry helpers", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("accepts incoming W3C trace context and creates child spans on the same trace", () => {
    const parentTraceparent =
      "00-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-bbbbbbbbbbbbbbbb-01";

    const context = createTelemetryContext({
      service: "api",
      operation: "POST /api/emails",
      headers: {
        traceparent: parentTraceparent,
        "x-correlation-id": "corr-123",
      },
    });

    expect(context.traceId).toBe("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
    expect(context.parentSpanId).toBe("bbbbbbbbbbbbbbbb");
    expect(context.correlationId).toBe("corr-123");
    expect(context.traceparent).toMatch(
      /^00-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-[a-f0-9]{16}-01$/,
    );

    const child = createChildTelemetryContext(context, {
      service: "worker",
      operation: "worker.email.send",
    });

    expect(child.traceId).toBe(context.traceId);
    expect(child.parentSpanId).toBe(context.spanId);
    expect(child.correlationId).toBe("corr-123");
    expect(child.traceparent).toMatch(
      /^00-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-[a-f0-9]{16}-01$/,
    );
  });

  it("redacts PII-bearing fields and hashes email addresses in freeform logs", () => {
    const sanitized = sanitizeTelemetryFields({
      Authorization: "Bearer secret-token",
      apiKey: "re_secret",
      from: "sender@example.com",
      metadata: "recipient@example.com clicked",
      email_id: "email-1",
      requestBody: "raw payload",
      nested: {
        subject: "Account reset",
      },
    }) as Record<string, unknown>;

    const serialized = JSON.stringify(sanitized);
    expect(serialized).not.toContain("secret-token");
    expect(serialized).not.toContain("re_secret");
    expect(serialized).not.toContain("sender@example.com");
    expect(serialized).not.toContain("recipient@example.com");
    expect(serialized).not.toContain("Account reset");
    expect(serialized).not.toContain("raw payload");
    expect(sanitized.email_id).toBe("email-1");
    expect(serialized).toContain("[redacted:sha256:");
  });

  it("emits CloudWatch EMF metric records with trace and correlation fields", () => {
    const infoSpy = vi
      .spyOn(console, "info")
      .mockImplementation(() => undefined);
    const context = createTelemetryContext({
      service: "worker",
      operation: "ses.send",
      correlationId: "corr-metric",
    });

    emitCloudWatchMetric(context, {
      metrics: [
        { name: "SendOutcome", value: 1, unit: "Count" },
        { name: "SendLatency", value: 42, unit: "Milliseconds" },
      ],
      dimensions: {
        Service: "worker",
        Operation: "ses.send",
        Outcome: "sent",
      },
      fields: {
        to: ["recipient@example.com"],
      },
    });

    expect(infoSpy).toHaveBeenCalledOnce();
    const [line] = infoSpy.mock.calls[0] ?? [];
    const entry = JSON.parse(String(line)) as Record<string, unknown>;

    expect(entry.event).toBe("metric.emf");
    expect(entry.correlation_id).toBe("corr-metric");
    expect(entry.trace_id).toBe(context.traceId);
    expect(entry.SendOutcome).toBe(1);
    expect(entry.SendLatency).toBe(42);
    expect(entry.Service).toBe("worker");
    expect(entry.Operation).toBe("ses.send");
    expect(entry.Outcome).toBe("sent");
    expect(JSON.stringify(entry)).not.toContain("recipient@example.com");

    const aws = entry._aws as {
      CloudWatchMetrics: Array<{
        Namespace: string;
        Dimensions: string[][];
        Metrics: Array<{ Name: string; Unit: string }>;
      }>;
    };
    expect(aws.CloudWatchMetrics[0]).toMatchObject({
      Namespace: "Opensend",
      Dimensions: [["Service", "Operation", "Outcome"]],
      Metrics: [
        { Name: "SendOutcome", Unit: "Count" },
        { Name: "SendLatency", Unit: "Milliseconds" },
      ],
    });
  });
});
