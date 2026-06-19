import { randomUUID } from "node:crypto";
import {
  getApiKeyAuthHeaderError,
  publicApiKeyUnauthorizedResponse,
  validateApiKey,
} from "@/lib/api-auth";
import { requireAllowedBatchSendingDomains } from "@/lib/api-key-permissions";
import { captureApiResponseLog } from "@/lib/api-logging";
import { getIdempotencyWindowStart } from "@/lib/api/emails/idempotency";
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
  BackgroundJobDeliveryUnavailableError,
  type PublicApiErrorEnvelope,
  batchSendEmailSchema,
  createBackgroundJob,
  createTelemetryContext,
  detectSandboxTestRecipient,
  emitCloudWatchMetric,
  enqueueEmailWebhookEvent,
  getSandboxTestOutcomeForRecipients,
  getTelemetryCarrier,
  logTelemetry,
  normalizeEmailRecipient,
  normalizeScheduledAt,
  prepareOutboundReplyTracking,
  publicApiError,
  publishBackgroundJob,
  recordTelemetryError,
  zodValidationDetails,
} from "@opensend/core";
import { and, eq, gte, lt } from "drizzle-orm";

type BatchSendResultItem = { id: string } | { error: PublicApiErrorEnvelope };
type BatchSendResponseBody = { data: BatchSendResultItem[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPublicApiErrorEnvelope(
  value: unknown,
): value is PublicApiErrorEnvelope {
  if (!isRecord(value)) return false;
  return (
    typeof value.name === "string" &&
    typeof value.code === "string" &&
    typeof value.message === "string" &&
    typeof value.statusCode === "number"
  );
}

function isBatchSendResultItem(value: unknown): value is BatchSendResultItem {
  if (!isRecord(value)) return false;
  if (typeof value.id === "string") return true;
  return isPublicApiErrorEnvelope(value.error);
}

function isBatchSendResponseBody(
  value: unknown,
): value is BatchSendResponseBody {
  if (!isRecord(value) || !Array.isArray(value.data)) return false;
  return value.data.every(isBatchSendResultItem);
}

function getBatchReplayResponse(existing: {
  id: string;
  document: unknown;
}): BatchSendResponseBody {
  const document = existing.document;
  if (isRecord(document) && isRecord(document.idempotency)) {
    const { idempotency } = document;
    if (
      idempotency.endpoint === "emails.batch" &&
      isBatchSendResponseBody(idempotency.response)
    ) {
      return idempotency.response;
    }
  }

  return { data: [{ id: existing.id }] };
}

function emailIdsFromBatchResponse(response: BatchSendResponseBody): string[] {
  return response.data.flatMap((item) => ("id" in item ? [item.id] : []));
}

// ── Helpers ───────────────────────────────────────────────────────

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

async function emitSuppressedWebhook(input: {
  userId: string;
  recipients: Array<{ email: string; reason: string }>;
}): Promise<void> {
  if (input.recipients.length === 0) return;

  const submittedAt = new Date();
  await enqueueEmailWebhookEvent({
    type: "email.suppressed",
    userId: input.userId,
    payload: {
      reason: "recipient_suppressed",
      recipients: input.recipients,
      recipient_count: input.recipients.length,
      submitted_at: submittedAt.toISOString(),
    },
    receivedAt: submittedAt,
  });
}

async function emitScheduledWebhook(input: {
  userId: string;
  emailId: string;
  scheduledAt: Date;
  recipientCount: number;
}): Promise<void> {
  const acceptedAt = new Date();
  await enqueueEmailWebhookEvent({
    type: "email.scheduled",
    userId: input.userId,
    emailId: input.emailId,
    sourceId: `scheduled:${input.emailId}`,
    payload: {
      email_id: input.emailId,
      status: "scheduled",
      scheduled_at: input.scheduledAt.toISOString(),
      accepted_at: acceptedAt.toISOString(),
      recipient_count: input.recipientCount,
    },
    receivedAt: acceptedAt,
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

function sandboxMixedRecipientError() {
  return publicApiError(
    "validation_error",
    "Sandbox test recipients cannot be mixed with real recipients or different sandbox outcomes in the same email. Use separate batch items instead.",
    422,
    {
      formErrors: [
        "Sandbox test recipients cannot be mixed with real recipients or different sandbox outcomes in the same email.",
      ],
      fieldErrors: {},
    },
  );
}

function hasSandboxTestRecipient(recipients: string[]): boolean {
  return recipients.some((recipient) => detectSandboxTestRecipient(recipient));
}

function getSandboxRecipientsForMessage(input: {
  to: string[];
  cc?: string[];
  bcc?: string[];
}): string[] {
  return [...input.to, ...(input.cc ?? []), ...(input.bcc ?? [])];
}

function sandboxSuppressedRecipientError(recipients: string[]) {
  return publicApiError(
    "recipient_suppressed",
    recipients.length === 1
      ? `Recipient ${recipients[0]} is suppressed. Remove the suppression before sending again.`
      : "One or more recipients are suppressed.",
    422,
    {
      recipients: recipients.join(","),
      reason: "suppressed",
      scope: "sandbox",
    },
  );
}

function findSandboxSuppressedRecipients(recipients: string[]): string[] {
  return recipients.filter(
    (recipient) =>
      detectSandboxTestRecipient(recipient)?.outcome === "suppressed",
  );
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

export async function handlePostEmailBatchRequest(
  request: Request,
): Promise<Response> {
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
    (idempotencyKey.length < 1 || idempotencyKey.length > 256)
  ) {
    recordBatchMetric(telemetry, {
      durationMs: performance.now() - startedAt,
      outcome: "invalid",
    });
    return await logResponse(
      jsonWithTelemetry(
        publicApiError(
          "invalid_idempotency_key",
          "Idempotency-Key must be between 1 and 256 characters.",
          400,
        ),
        telemetry,
        { status: 400 },
      ),
    );
  }

  const idempotencyWindowStart = getIdempotencyWindowStart();

  if (idempotencyKey) {
    const existing = await db.query.emails.findFirst({
      where: and(
        eq(emails.idempotencyKey, idempotencyKey),
        eq(emails.userId, userId),
        gte(emails.createdAt, idempotencyWindowStart),
      ),
    });
    if (existing) {
      const replayResponse = getBatchReplayResponse(existing);
      const replayEmailIds = emailIdsFromBatchResponse(replayResponse);
      recordBatchMetric(telemetry, {
        durationMs: performance.now() - startedAt,
        outcome: "accepted",
        count: 0,
      });
      return await logResponse(
        jsonWithTelemetry(replayResponse, telemetry, { status: 200 }),
        {
          emailId: replayEmailIds[0] ?? existing.id,
          emailIds: replayEmailIds,
          idempotencyReplay: true,
        },
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

  const domainRestrictionError = await requireAllowedBatchSendingDomains(
    auth,
    validatedItems.map((item) => item.from),
    {
      headers: {
        "x-correlation-id": telemetry.correlationId,
        traceparent: telemetry.traceparent,
      },
    },
  );
  if (domainRestrictionError) {
    recordBatchMetric(telemetry, {
      durationMs: performance.now() - startedAt,
      outcome: "unauthorized",
    });
    return await logResponse(domainRestrictionError);
  }
  const itemRecipients = validatedItems.map(
    (item) => normalizeEmailRecipient(item.to) as string[],
  );
  const itemSandboxRecipients = validatedItems.map((item, index) =>
    getSandboxRecipientsForMessage({
      to: itemRecipients[index] ?? [],
      cc: normalizeEmailRecipient(item.cc),
      bcc: normalizeEmailRecipient(item.bcc),
    }),
  );
  const hasMixedSandboxItem = itemSandboxRecipients.some(
    (recipients) =>
      hasSandboxTestRecipient(recipients) &&
      !getSandboxTestOutcomeForRecipients(recipients),
  );
  if (hasMixedSandboxItem) {
    recordBatchMetric(telemetry, {
      durationMs: performance.now() - startedAt,
      outcome: "invalid",
    });
    return await logResponse(
      jsonWithTelemetry(sandboxMixedRecipientError(), telemetry, {
        status: 422,
      }),
    );
  }

  const sandboxSuppressedResults = itemSandboxRecipients.map((recipients) =>
    findSandboxSuppressedRecipients(recipients),
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
    (entries, index) =>
      entries.length === 0 && sandboxSuppressedResults[index]?.length === 0,
  ).length;
  const suppressedWebhookEvents = validatedItems.flatMap((_, index) => {
    const sandboxSuppressed = sandboxSuppressedResults[index] ?? [];
    if (sandboxSuppressed.length > 0) {
      return [
        {
          userId,
          recipients: sandboxSuppressed.map((email) => ({
            email,
            reason: "suppressed",
          })),
        },
      ];
    }

    const suppressed = suppressedResults[index] ?? [];
    if (suppressed.length === 0) return [];

    return [
      {
        userId,
        recipients: suppressed.map((entry) => ({
          email: entry.email,
          reason: entry.reason,
        })),
      },
    ];
  });
  await Promise.all(suppressedWebhookEvents.map(emitSuppressedWebhook));
  let quotaReserved = false;
  const firstAcceptedIndex = suppressedResults.findIndex(
    (entries, index) =>
      entries.length === 0 && sandboxSuppressedResults[index]?.length === 0,
  );

  try {
    const reservation = await db.transaction(async (tx) => {
      if (idempotencyKey) {
        await tx
          .update(emails)
          .set({ idempotencyKey: null })
          .where(
            and(
              eq(emails.idempotencyKey, idempotencyKey),
              eq(emails.userId, userId),
              lt(emails.createdAt, idempotencyWindowStart),
            ),
          );
      }

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
        scheduledAt: Date | null;
        recipientCount: number;
      }> = [];

      for (const [index, item] of validatedItems.entries()) {
        if (
          suppressedResults[index]?.length ||
          sandboxSuppressedResults[index]?.length
        ) {
          continue;
        }
        const to = normalizeEmailRecipient(item.to) as string[];
        const cc = normalizeEmailRecipient(item.cc);
        const bcc = normalizeEmailRecipient(item.bcc);
        const replyTo = normalizeEmailRecipient(item.reply_to);
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
        const emailId = randomUUID();
        const replyTracking = await prepareOutboundReplyTracking({
          userId,
          emailId,
          from: item.from,
          providedReplyTo: replyTo,
          headers: managedUnsubscribe.headers,
        });
        const finalHeaders = replyTracking.enabled
          ? { ...managedUnsubscribe.headers, ...replyTracking.headers }
          : managedUnsubscribe.headers;

        const [email] = await tx
          .insert(emails)
          .values({
            id: emailId,
            from: item.from,
            to,
            cc: cc ?? [],
            bcc: bcc ?? [],
            replyTo: replyTracking.enabled
              ? replyTracking.replyTo
              : (replyTo ?? []),
            subject: item.subject,
            html: managedUnsubscribe.html,
            text: managedUnsubscribe.text,
            tags: item.tags ?? [],
            headers: finalHeaders,
            attachments: normalizeAttachmentsForStorage(item.attachments),
            status: shouldQueueNow ? "queued" : "scheduled",
            scheduledAt: scheduledAt,
            topicId: item.topic_id || null,
            idempotencyKey:
              index === firstAcceptedIndex ? idempotencyKey : null,
            threadId: replyTracking.enabled ? replyTracking.threadId : null,
            replyAddress: replyTracking.enabled
              ? replyTracking.replyAddress
              : null,
            replyToken: replyTracking.enabled ? replyTracking.replyToken : null,
            userId: auth.userId,
          })
          .returning({ id: emails.id });

        persisted.push({
          index,
          id: email.id,
          shouldQueueNow,
          scheduledAt,
          recipientCount: to.length,
        });
      }

      const resultByIndex = new Map<number, { id: string }>();
      for (const email of persisted) {
        resultByIndex.set(email.index, { id: email.id });
      }

      const responseBody: BatchSendResponseBody = {
        data: validatedItems.map((_, index) => {
          const success = resultByIndex.get(index);
          if (success) return success;
          const sandboxSuppressed = sandboxSuppressedResults[index] ?? [];
          if (sandboxSuppressed.length > 0) {
            return {
              error: sandboxSuppressedRecipientError(sandboxSuppressed),
            };
          }
          return {
            error: suppressedRecipientError(suppressedResults[index] ?? []),
          };
        }),
      };

      const replayAnchor = persisted.find(
        (email) => email.index === firstAcceptedIndex,
      );
      if (idempotencyKey && replayAnchor) {
        await tx
          .update(emails)
          .set({
            document: {
              idempotency: {
                endpoint: "emails.batch",
                response: responseBody,
              },
            },
          })
          .where(
            and(eq(emails.id, replayAnchor.id), eq(emails.userId, userId)),
          );
      }

      return { ok: true as const, emails: persisted, responseBody };
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

    quotaReserved = false;
    await Promise.all(
      reservation.emails
        .filter((email) => !email.shouldQueueNow && email.scheduledAt)
        .map((email) =>
          emitScheduledWebhook({
            userId,
            emailId: email.id,
            scheduledAt: email.scheduledAt as Date,
            recipientCount: email.recipientCount,
          }),
        ),
    );

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
    return await logResponse(
      jsonWithTelemetry(reservation.responseBody, telemetry),
      {
        emailIds: reservation.emails.map((email) => email.id),
      },
    );
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

    if (err instanceof BackgroundJobDeliveryUnavailableError) {
      return await logResponse(
        jsonWithTelemetry(
          publicApiError(err.code, err.message, err.statusCode),
          telemetry,
          { status: err.statusCode },
        ),
      );
    }

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
