import {
  getApiKeyAuthHeaderError,
  publicApiKeyUnauthorizedResponse,
  validateApiKey,
} from "@/lib/api-auth";
import { publicApiError, zodValidationDetails } from "@/lib/api-errors";
import { quotaExceededResponse, reserveEmailQuota } from "@/lib/billing/quota";
import { db } from "@/lib/db";
import { contacts, emails } from "@/lib/db/schema";
import { normalizeAttachmentsForStorage } from "@/lib/email-attachments";
import {
  buildOneClickUnsubscribeHeaders,
  createUnsubscribeUrl,
  getPublicBaseUrl,
  hasUnsubscribePlaceholder,
  replaceUnsubscribePlaceholder,
} from "@/lib/unsubscribe";
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
import { and, eq } from "drizzle-orm";

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

async function applyManagedUnsubscribe(input: {
  userId: string | null;
  to: string[];
  html: string;
  text: string;
  headers: Record<string, string>;
  baseUrl: string;
}): Promise<{ html: string; text: string; headers: Record<string, string> }> {
  if (
    input.to.length !== 1 ||
    (!hasUnsubscribePlaceholder(input.html) &&
      !hasUnsubscribePlaceholder(input.text))
  ) {
    return { html: input.html, text: input.text, headers: input.headers };
  }

  const recipient = input.to[0];
  if (!recipient) {
    return { html: input.html, text: input.text, headers: input.headers };
  }

  const contact = await db.query.contacts.findFirst({
    where: input.userId
      ? and(eq(contacts.email, recipient), eq(contacts.userId, input.userId))
      : eq(contacts.email, recipient),
  });

  if (!contact || contact.unsubscribed) {
    return { html: input.html, text: input.text, headers: input.headers };
  }

  const unsubscribeUrl = createUnsubscribeUrl(contact.id, input.baseUrl);
  return {
    html: replaceUnsubscribePlaceholder(input.html, unsubscribeUrl),
    text: replaceUnsubscribePlaceholder(input.text, unsubscribeUrl),
    headers: {
      ...input.headers,
      ...buildOneClickUnsubscribeHeaders(unsubscribeUrl),
    },
  };
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

  const authHeader = request.headers.get("authorization");
  const authHeaderError = getApiKeyAuthHeaderError(authHeader);
  const auth = authHeaderError ? null : await validateApiKey(authHeader);
  if (!auth) {
    recordBatchMetric(telemetry, {
      durationMs: performance.now() - startedAt,
      outcome: "unauthorized",
    });
    return publicApiKeyUnauthorizedResponse(
      authHeaderError ?? "invalid_api_key",
      {
        headers: {
          "x-correlation-id": telemetry.correlationId,
          traceparent: telemetry.traceparent,
        },
      },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    recordBatchMetric(telemetry, {
      durationMs: performance.now() - startedAt,
      outcome: "invalid",
    });
    return jsonWithTelemetry(
      publicApiError("invalid_json", "Request body must be valid JSON.", 400),
      telemetry,
      { status: 400 },
    );
  }

  const result = batchSendEmailSchema.safeParse(body);
  if (!result.success) {
    recordBatchMetric(telemetry, {
      durationMs: performance.now() - startedAt,
      outcome: "invalid",
    });
    return jsonWithTelemetry(
      publicApiError(
        "validation_error",
        "Validation failed.",
        422,
        zodValidationDetails(result.error),
      ),
      telemetry,
      { status: 422 },
    );
  }

  const validatedItems = result.data;

  try {
    const reservation = await db.transaction(async (tx) => {
      // Quota gate: reserve the entire batch atomically in the same transaction
      // that persists all accepted rows. If the batch would overrun, no rows are
      // inserted and the whole request returns 402.
      const quota = await reserveEmailQuota(
        auth.userId,
        validatedItems.length,
        new Date(),
        process.env,
        tx,
      );
      if (!quota.ok) {
        return quota;
      }
      const persisted: Array<{ id: string; shouldQueueNow: boolean }> = [];

      for (const item of validatedItems) {
        const to = normalizeToArray(item.to) as string[];
        const cc = normalizeToArray(item.cc);
        const bcc = normalizeToArray(item.bcc);
        const replyTo = normalizeToArray(item.reply_to);
        const scheduledAt = item.scheduled_at
          ? new Date(item.scheduled_at)
          : null;

        const shouldQueueNow = !scheduledAt || scheduledAt <= new Date();
        const managedUnsubscribe = await applyManagedUnsubscribe({
          userId: auth.userId,
          to,
          html: item.html ?? "",
          text: item.text ?? "",
          headers: (item.headers as Record<string, string>) ?? {},
          baseUrl: getPublicBaseUrl(request),
        });

        const [email] = await tx
          .insert(emails)
          .values({
            from: item.from,
            to,
            cc: cc ?? [],
            bcc: bcc ?? [],
            replyTo: replyTo ?? [],
            subject: item.subject,
            html: managedUnsubscribe.html,
            text: managedUnsubscribe.text,
            tags: item.tags ?? [],
            headers: managedUnsubscribe.headers,
            attachments: normalizeAttachmentsForStorage(item.attachments),
            status: shouldQueueNow ? "queued" : "scheduled",
            scheduledAt: scheduledAt,
            topicId: item.topic_id || null,
            userId: auth.userId,
          })
          .returning({ id: emails.id });

        persisted.push({ id: email.id, shouldQueueNow });
      }

      return { ok: true as const, emails: persisted };
    });

    if (!reservation.ok) {
      logTelemetry("info", "email.batch_quota_exceeded", telemetry, {
        plan: reservation.info.plan,
        limit: reservation.info.limit,
        used: reservation.info.used,
        requested: validatedItems.length,
      });
      recordBatchMetric(telemetry, {
        durationMs: performance.now() - startedAt,
        outcome: "invalid",
      });
      return quotaExceededResponse(reservation.info, {
        headers: {
          "x-correlation-id": telemetry.correlationId,
          traceparent: telemetry.traceparent,
        },
      });
    }

    const results: Array<{ id: string }> = [];
    const CONCURRENCY = 5;
    const queuedEmails = reservation.emails.filter(
      (email) => email.shouldQueueNow,
    );

    for (let i = 0; i < queuedEmails.length; i += CONCURRENCY) {
      const chunk = queuedEmails.slice(i, i + CONCURRENCY);
      await Promise.all(
        chunk.map(async (email) => {
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
        }),
      );
    }

    results.push(...reservation.emails.map((email) => ({ id: email.id })));

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
    return jsonWithTelemetry(
      publicApiError(
        "internal_server_error",
        "Failed to send batch emails.",
        500,
      ),
      telemetry,
      { status: 500 },
    );
  }
}
