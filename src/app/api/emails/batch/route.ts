import { unauthorizedResponse, validateApiKey } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { emails } from "@/lib/db/schema";
import { normalizeAttachmentsForStorage } from "@/lib/email-attachments";
import { batchSendEmailSchema } from "@/lib/validation/emails";
import {
  createBackgroundJob,
  createTelemetryContext,
  emitCloudWatchMetric,
  getTelemetryCarrier,
  logTelemetry,
  publishBackgroundJob,
  recordTelemetryError,
} from "@opensend/core";
import { eq } from "drizzle-orm";

// ── Helpers ───────────────────────────────────────────────────────

function normalizeToArray(
  value: string | string[] | undefined,
): string[] | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value : [value];
}

function jsonWithTelemetry(
  body: unknown,
  telemetry: ReturnType<typeof createTelemetryContext>,
  init?: ResponseInit,
): Response {
  const headers = new Headers(init?.headers);
  headers.set("x-correlation-id", telemetry.correlationId);
  headers.set("traceparent", telemetry.traceparent);
  return Response.json(body, { ...init, headers });
}

function recordBatchMetric(
  telemetry: ReturnType<typeof createTelemetryContext>,
  input: {
    durationMs: number;
    outcome: "accepted" | "failed" | "unauthorized" | "invalid";
    count?: number;
  },
): void {
  emitCloudWatchMetric(telemetry, {
    metrics: [
      { name: "EmailBatchAccepted", value: input.count ?? 0, unit: "Count" },
      {
        name: "EmailBatchAcceptLatency",
        value: Math.round(input.durationMs),
        unit: "Milliseconds",
      },
    ],
    dimensions: {
      Service: "api",
      Operation: "email.batch_accept",
      Outcome: input.outcome,
    },
  });
}

// ── POST /api/emails/batch ────────────────────────────────────────

export async function POST(request: Request): Promise<Response> {
  const telemetry = createTelemetryContext({
    service: "api",
    operation: "POST /api/emails/batch",
    headers: request.headers,
  });
  const startedAt = performance.now();
  logTelemetry("info", "api.request.start", telemetry, {
    method: "POST",
    route: "/api/emails/batch",
  });

  const auth = await validateApiKey(request.headers.get("authorization"));
  if (!auth) {
    recordBatchMetric(telemetry, {
      durationMs: performance.now() - startedAt,
      outcome: "unauthorized",
    });
    const response = unauthorizedResponse();
    response.headers.set("x-correlation-id", telemetry.correlationId);
    response.headers.set("traceparent", telemetry.traceparent);
    return response;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    recordBatchMetric(telemetry, {
      durationMs: performance.now() - startedAt,
      outcome: "invalid",
    });
    return jsonWithTelemetry({ error: "Invalid JSON body" }, telemetry, {
      status: 400,
    });
  }

  const result = batchSendEmailSchema.safeParse(body);
  if (!result.success) {
    recordBatchMetric(telemetry, {
      durationMs: performance.now() - startedAt,
      outcome: "invalid",
    });
    return jsonWithTelemetry(
      { error: "Validation failed", details: result.error.flatten() },
      telemetry,
      { status: 422 },
    );
  }

  const validatedItems = result.data;

  try {
    // Send emails with controlled concurrency (5 at a time)
    const CONCURRENCY = 5;
    const results: Array<{ id: string }> = [];

    for (let i = 0; i < validatedItems.length; i += CONCURRENCY) {
      const chunk = validatedItems.slice(i, i + CONCURRENCY);
      const chunkResults = await Promise.all(
        chunk.map(async (item) => {
          const to = normalizeToArray(item.to) as string[];
          const cc = normalizeToArray(item.cc);
          const bcc = normalizeToArray(item.bcc);
          const replyTo = normalizeToArray(item.reply_to);
          const scheduledAt = item.scheduled_at
            ? new Date(item.scheduled_at)
            : null;

          const shouldQueueNow = !scheduledAt || scheduledAt <= new Date();

          const [email] = await db
            .insert(emails)
            .values({
              from: item.from,
              to,
              cc: cc ?? [],
              bcc: bcc ?? [],
              replyTo: replyTo ?? [],
              subject: item.subject,
              html: item.html ?? "",
              text: item.text ?? "",
              tags: item.tags ?? [],
              headers: (item.headers as Record<string, string>) ?? {},
              attachments: normalizeAttachmentsForStorage(item.attachments),
              status: shouldQueueNow ? "queued" : "scheduled",
              scheduledAt: scheduledAt,
              topicId: item.topic_id || null,
            })
            .returning({ id: emails.id });

          if (shouldQueueNow) {
            try {
              await publishBackgroundJob(
                createBackgroundJob({
                  id: `email.send:${email.id}`,
                  type: "email.send",
                  source: "api",
                  emailId: email.id,
                  trace: getTelemetryCarrier(telemetry),
                }),
                {
                  deduplicationId: `email.send:${email.id}`,
                  groupId: "email.send",
                },
              );
            } catch (error) {
              await db
                .update(emails)
                .set({ status: "failed" })
                .where(eq(emails.id, email.id));
              recordTelemetryError(
                telemetry,
                "email.batch_accept.queue_publish_failed",
                error,
                { email_id: email.id },
              );
              throw error;
            }
          }

          return { id: email.id };
        }),
      );
      results.push(...chunkResults);
    }

    const durationMs = performance.now() - startedAt;
    logTelemetry("info", "email.batch_accepted", telemetry, {
      email_count: results.length,
      duration_ms: Math.round(durationMs),
    });
    recordBatchMetric(telemetry, {
      durationMs,
      outcome: "accepted",
      count: results.length,
    });
    return jsonWithTelemetry({ data: results }, telemetry);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to send batch emails";
    recordTelemetryError(telemetry, "email.batch_accept.failed", err);
    emitCloudWatchMetric(telemetry, {
      metrics: [
        { name: "EmailBatchAcceptFailed", value: 1, unit: "Count" },
        {
          name: "EmailBatchAcceptLatency",
          value: Math.round(performance.now() - startedAt),
          unit: "Milliseconds",
        },
      ],
      dimensions: {
        Service: "api",
        Operation: "email.batch_accept",
        Outcome: "failed",
      },
    });
    return jsonWithTelemetry({ error: message }, telemetry, { status: 500 });
  }
}
