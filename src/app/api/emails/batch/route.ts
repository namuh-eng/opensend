import {
  getApiKeyAuthHeaderError,
  publicApiKeyUnauthorizedResponse,
  validateApiKey,
} from "@/lib/api-auth";
import { publicApiError, zodValidationDetails } from "@/lib/api-errors";
import { captureApiResponseLog } from "@/lib/api-logging";
import {
  quotaExceededResponse,
  releaseEmailQuota,
  reserveEmailQuota,
} from "@/lib/billing/quota";
import { db } from "@/lib/db";
import { contacts, emailEvents, emails } from "@/lib/db/schema";
import { normalizeAttachmentsForStorage } from "@/lib/email-attachments";
import {
  findSuppressedRecipients,
  suppressedRecipientError,
} from "@/lib/suppressions";
import {
  buildOneClickUnsubscribeHeaders,
  createUnsubscribeUrl,
  getPublicBaseUrl,
  hasUnsubscribePlaceholder,
  replaceUnsubscribePlaceholder,
} from "@/lib/unsubscribe";
import {
  batchSendEmailSchema,
  normalizeScheduledAt,
} from "@/lib/validation/emails";
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

function summarizeQueuePublishError(error: unknown): {
  code: string;
  message: string;
} {
  if (error instanceof Error) {
    return {
      code: error.name || "queue_publish_failed",
      message: error.message.slice(0, 1_000),
    };
  }

  if (typeof error === "object" && error !== null) {
    const record = error as Record<string, unknown>;
    const code =
      typeof record.code === "string"
        ? record.code
        : typeof record.name === "string"
          ? record.name
          : "queue_publish_failed";
    const message =
      typeof record.message === "string"
        ? record.message
        : "Failed to publish email send job.";
    return { code, message: message.slice(0, 1_000) };
  }

  return {
    code: "queue_publish_failed",
    message: "Failed to publish email send job.",
  };
}

async function auditQueuePublishFailure(input: {
  emailId: string;
  userId: string;
  error: unknown;
}): Promise<void> {
  const failedAt = new Date();
  const errorSummary = summarizeQueuePublishError(input.error);

  await db
    .update(emails)
    .set({
      status: "failed",
      providerLastAttemptedAt: failedAt,
      providerLastErrorCode: errorSummary.code,
      providerLastErrorMessage: errorSummary.message,
      providerNextRetryAt: null,
      providerDeadLetteredAt: failedAt,
    })
    .where(and(eq(emails.id, input.emailId), eq(emails.userId, input.userId)));

  await db.insert(emailEvents).values({
    emailId: input.emailId,
    userId: input.userId,
    sourceId: `queue-publish-failed:${input.emailId}`,
    type: "failed",
    payload: {
      reason: "queue_publish_failed",
      error: errorSummary,
    },
    receivedAt: failedAt,
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
  if (!auth || !auth.userId) {
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
  const userId = auth.userId;
  let requestBodyForLog: unknown = null;
  const logResponse = (
    response: Response,
    document?: Parameters<typeof captureApiResponseLog>[0]["document"],
  ) =>
    captureApiResponseLog({
      request,
      auth,
      requestBody: requestBodyForLog,
      response,
      document: {
        correlationId: telemetry.correlationId,
        traceparent: telemetry.traceparent,
        ...document,
      },
    });

  const idempotencyKey = request.headers.get("idempotency-key");
  if (
    idempotencyKey &&
    (idempotencyKey.length < 1 || idempotencyKey.length > 255)
  ) {
    recordBatchMetric(telemetry, {
      durationMs: performance.now() - startedAt,
      outcome: "invalid",
    });
    return await logResponse(
      jsonWithTelemetry(
        publicApiError(
          "invalid_idempotency_key",
          "Idempotency-Key must be between 1 and 255 characters.",
          400,
        ),
        telemetry,
        { status: 400 },
      ),
    );
  }

  if (idempotencyKey) {
    const existing = await db.query.emails.findFirst({
      where: and(
        eq(emails.idempotencyKey, idempotencyKey),
        eq(emails.userId, userId),
      ),
    });
    if (existing) {
      recordBatchMetric(telemetry, {
        durationMs: performance.now() - startedAt,
        outcome: "accepted",
        count: 0,
      });
      return await logResponse(
        jsonWithTelemetry(
          publicApiError(
            "idempotency_conflict",
            "A request with this idempotency key has already been accepted.",
            409,
            { id: existing.id },
          ),
          telemetry,
          { status: 409 },
        ),
        { emailId: existing.id },
      );
    }
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    recordBatchMetric(telemetry, {
      durationMs: performance.now() - startedAt,
      outcome: "invalid",
    });
    requestBodyForLog = { error: "invalid_json" };
    return await logResponse(
      jsonWithTelemetry(
        publicApiError("invalid_json", "Request body must be valid JSON.", 400),
        telemetry,
        { status: 400 },
      ),
    );
  }

  requestBodyForLog = body;

  const result = batchSendEmailSchema.safeParse(body);
  if (!result.success) {
    recordBatchMetric(telemetry, {
      durationMs: performance.now() - startedAt,
      outcome: "invalid",
    });
    return await logResponse(
      jsonWithTelemetry(
        publicApiError(
          "validation_error",
          "Validation failed.",
          422,
          zodValidationDetails(result.error),
        ),
        telemetry,
        { status: 422 },
      ),
    );
  }

  const validatedItems = result.data;
  const itemRecipients = validatedItems.map(
    (item) => normalizeToArray(item.to) as string[],
  );
  const suppressedByEmail = new Map(
    (
      await findSuppressedRecipients({
        userId: auth.userId,
        recipients: itemRecipients.flat(),
      })
    ).map((entry) => [entry.email, entry]),
  );
  const suppressedResults = itemRecipients.map((recipients) =>
    recipients
      .map((recipient) => suppressedByEmail.get(recipient.toLowerCase()))
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry)),
  );
  const acceptedCount = suppressedResults.filter(
    (entries) => entries.length === 0,
  ).length;
  let quotaReserved = false;
  const firstAcceptedIndex = suppressedResults.findIndex(
    (entries) => entries.length === 0,
  );

  try {
    const reservation = await db.transaction(async (tx) => {
      // Quota gate: reserve the entire batch atomically in the same transaction
      // that persists all accepted rows. If the batch would overrun, no rows are
      // inserted and the whole request returns 402.
      const quota = await reserveEmailQuota(
        auth.userId,
        acceptedCount,
        new Date(),
        process.env,
        tx,
      );
      if (!quota.ok) {
        return quota;
      }
      const persisted: Array<{
        index: number;
        id: string;
        shouldQueueNow: boolean;
      }> = [];

      for (const [index, item] of validatedItems.entries()) {
        if (suppressedResults[index]?.length) {
          continue;
        }
        const to = normalizeToArray(item.to) as string[];
        const cc = normalizeToArray(item.cc);
        const bcc = normalizeToArray(item.bcc);
        const replyTo = normalizeToArray(item.reply_to);
        const scheduledAt = item.scheduled_at
          ? normalizeScheduledAt(item.scheduled_at)
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
            idempotencyKey:
              index === firstAcceptedIndex ? idempotencyKey : null,
            userId: auth.userId,
          })
          .returning({ id: emails.id });

        persisted.push({ index, id: email.id, shouldQueueNow });
      }

      return { ok: true as const, emails: persisted };
    });

    if (!reservation.ok) {
      logTelemetry("info", "email.batch_quota_exceeded", telemetry, {
        plan: reservation.info.plan,
        limit: reservation.info.limit,
        used: reservation.info.used,
        requested: acceptedCount,
      });
      recordBatchMetric(telemetry, {
        durationMs: performance.now() - startedAt,
        outcome: "invalid",
      });
      return await logResponse(
        quotaExceededResponse(reservation.info, {
          headers: {
            "x-correlation-id": telemetry.correlationId,
            traceparent: telemetry.traceparent,
          },
        }),
      );
    }

    quotaReserved = true;

    const resultByIndex = new Map<number, { id: string }>();
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
            await auditQueuePublishFailure({
              emailId: email.id,
              userId,
              error,
            });
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

    for (const email of reservation.emails) {
      resultByIndex.set(email.index, { id: email.id });
    }

    const results = validatedItems.map((_, index) => {
      const success = resultByIndex.get(index);
      if (success) return success;
      return {
        error: suppressedRecipientError(suppressedResults[index] ?? []),
      };
    });

    const durationMs = performance.now() - startedAt;
    logTelemetry("info", "email.batch_accepted", telemetry, {
      email_count: acceptedCount,
      duration_ms: Math.round(durationMs),
    });
    recordBatchMetric(telemetry, {
      durationMs,
      outcome: "accepted",
      count: acceptedCount,
    });
    quotaReserved = false;
    return await logResponse(jsonWithTelemetry({ data: results }, telemetry), {
      emailIds: reservation.emails.map((email) => email.id),
    });
  } catch (err) {
    recordTelemetryError(telemetry, "email.batch_accept.failed", err);
    if (quotaReserved) {
      await releaseEmailQuota(userId, acceptedCount);
    }
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
    return await logResponse(
      jsonWithTelemetry(
        publicApiError(
          "internal_server_error",
          "Failed to send batch emails.",
          500,
        ),
        telemetry,
        { status: 500 },
      ),
    );
  }
}
