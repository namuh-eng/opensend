import {
  getApiKeyAuthHeaderError,
  publicApiKeyUnauthorizedResponse,
  unauthorizedResponse,
  validateApiKey,
} from "@/lib/api-auth";
import { publicApiError, zodValidationDetails } from "@/lib/api-errors";
import {
  requireAllowedSendingDomain,
  requireFullAccessApiKey,
} from "@/lib/api-key-permissions";
import { captureApiResponseLog } from "@/lib/api-logging";
import {
  quotaExceededResponse,
  releaseEmailQuota,
  reserveEmailQuota,
} from "@/lib/billing/quota";
import { db } from "@/lib/db";
import { contacts, emailEvents, emails, templates } from "@/lib/db/schema";
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
import { normalizeScheduledAt, sendEmailSchema } from "@/lib/validation/emails";
import {
  createBackgroundJob,
  createTelemetryContext,
  emitCloudWatchMetric,
  getTelemetryCarrier,
  logTelemetry,
  publishBackgroundJob,
  recordTelemetryError,
} from "@opensend/core";
import { type SQL, and, desc, eq, gt, lt } from "drizzle-orm";
import type { ZodError } from "zod";

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

function recordAcceptMetric(
  telemetry: ReturnType<typeof createTelemetryContext>,
  input: {
    durationMs: number;
    outcome: "queued" | "scheduled" | "failed" | "unauthorized" | "invalid";
  },
): void {
  emitCloudWatchMetric(telemetry, {
    metrics: [
      { name: "EmailAccept", value: 1, unit: "Count" },
      {
        name: "EmailAcceptLatency",
        value: Math.round(input.durationMs),
        unit: "Milliseconds",
      },
    ],
    dimensions: {
      Service: "api",
      Operation: "email.accept",
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

// ── POST /api/emails ──────────────────────────────────────────────

export async function POST(request: Request): Promise<Response> {
  const telemetry = createTelemetryContext({
    service: "api",
    operation: "POST /api/emails",
    headers: request.headers,
  });
  const startedAt = performance.now();
  logTelemetry("info", "api.request.start", telemetry, {
    method: "POST",
    route: "/api/emails",
  });

  const authHeader = request.headers.get("authorization");
  const authHeaderError = getApiKeyAuthHeaderError(authHeader);
  const auth = authHeaderError ? null : await validateApiKey(authHeader);
  if (!auth || !auth.userId) {
    recordAcceptMetric(telemetry, {
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
    recordAcceptMetric(telemetry, {
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    recordAcceptMetric(telemetry, {
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

  const result = sendEmailSchema.safeParse(body);
  if (!result.success) {
    recordAcceptMetric(telemetry, {
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

  const validated = result.data;

  const domainRestrictionError = await requireAllowedSendingDomain(
    auth,
    validated.from,
    {
      headers: {
        "x-correlation-id": telemetry.correlationId,
        traceparent: telemetry.traceparent,
      },
    },
  );
  if (domainRestrictionError) {
    recordAcceptMetric(telemetry, {
      durationMs: performance.now() - startedAt,
      outcome: "unauthorized",
    });
    return await logResponse(domainRestrictionError);
  }

  // Idempotency check
  if (idempotencyKey) {
    const existing = await db.query.emails.findFirst({
      where: and(
        eq(emails.idempotencyKey, idempotencyKey),
        eq(emails.userId, auth.userId),
      ),
    });
    if (existing) {
      recordAcceptMetric(telemetry, {
        durationMs: performance.now() - startedAt,
        outcome: "queued",
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

  const to = normalizeToArray(validated.to) as string[];
  const cc = normalizeToArray(validated.cc);
  const bcc = normalizeToArray(validated.bcc);
  const replyTo = normalizeToArray(validated.reply_to);
  const scheduledAt = validated.scheduled_at
    ? normalizeScheduledAt(validated.scheduled_at)
    : null;

  const suppressedRecipients = await findSuppressedRecipients({
    userId: auth.userId,
    recipients: to,
  });
  if (suppressedRecipients.length > 0) {
    recordAcceptMetric(telemetry, {
      durationMs: performance.now() - startedAt,
      outcome: "invalid",
    });
    return await logResponse(
      jsonWithTelemetry(
        suppressedRecipientError(suppressedRecipients),
        telemetry,
        {
          status: 422,
        },
      ),
    );
  }

  let quotaReserved = false;
  try {
    let finalHtml = validated.html || "";
    let finalText = validated.text ?? "";
    let finalHeaders = (validated.headers as Record<string, string>) ?? {};
    let finalSubject = validated.subject;

    // Handle template resolving
    if (validated.template) {
      const template = await db.query.templates.findFirst({
        where: and(
          eq(templates.id, validated.template.id),
          eq(templates.userId, auth.userId),
        ),
      });
      if (!template) {
        recordAcceptMetric(telemetry, {
          durationMs: performance.now() - startedAt,
          outcome: "invalid",
        });
        return await logResponse(
          jsonWithTelemetry(
            publicApiError("not_found", "Template not found.", 404),
            telemetry,
            { status: 404 },
          ),
        );
      }

      // Validate required variables
      const templateVars =
        (template.variables as Array<{
          name: string;
          required: boolean;
        }>) ?? [];
      const requiredVars = templateVars
        .filter((v) => v.required)
        .map((v) => v.name);
      const providedVars = validated.template.variables ?? {};

      for (const requiredVar of requiredVars) {
        if (providedVars[requiredVar] === undefined) {
          recordAcceptMetric(telemetry, {
            durationMs: performance.now() - startedAt,
            outcome: "invalid",
          });
          return await logResponse(
            jsonWithTelemetry(
              publicApiError(
                "validation_error",
                `Missing required template variable: ${requiredVar}`,
                422,
                {
                  formErrors: [],
                  fieldErrors: {
                    template: [`Missing required variable: ${requiredVar}`],
                  },
                },
              ),
              telemetry,
              { status: 422 },
            ),
          );
        }
      }

      finalHtml = template.html || "";
      if (template.subject) finalSubject = template.subject;

      // Simple variable replacement
      if (validated.template.variables) {
        for (const [key, value] of Object.entries(
          validated.template.variables,
        )) {
          const regex = new RegExp(`{{\\s*${key}\\s*}}`, "g");
          finalHtml = finalHtml.replace(regex, String(value));
          finalSubject = finalSubject.replace(regex, String(value));
        }
      }
    }

    const shouldQueueNow = !scheduledAt || scheduledAt <= new Date();

    // Quota gate: post-validation and committed in the same transaction as the
    // durable email row. SQS publish remains after commit so workers can read it.
    const email = await db.transaction(async (tx) => {
      const quota = await reserveEmailQuota(
        auth.userId,
        1,
        new Date(),
        process.env,
        tx,
      );
      if (!quota.ok) {
        return quota;
      }
      quotaReserved = !quota.bypassed;

      const managedUnsubscribe = await applyManagedUnsubscribe({
        userId: auth.userId,
        to,
        html: finalHtml,
        text: finalText,
        headers: finalHeaders,
        baseUrl: getPublicBaseUrl(request),
      });
      finalHtml = managedUnsubscribe.html;
      finalText = managedUnsubscribe.text;
      finalHeaders = managedUnsubscribe.headers;

      const [created] = await tx
        .insert(emails)
        .values({
          from: validated.from,
          to,
          cc: cc ?? [],
          bcc: bcc ?? [],
          replyTo: replyTo ?? [],
          subject: finalSubject,
          html: finalHtml,
          text: finalText,
          tags: validated.tags ?? [],
          headers: finalHeaders,
          attachments: normalizeAttachmentsForStorage(validated.attachments),
          status: shouldQueueNow ? "queued" : "scheduled",
          scheduledAt: scheduledAt,
          topicId: validated.topic_id || null,
          idempotencyKey: idempotencyKey,
          userId: auth.userId, // Link to the user who owns the API key
        })
        .returning({ id: emails.id });

      return { ok: true as const, email: created };
    });

    if (!email.ok) {
      logTelemetry("info", "email.quota_exceeded", telemetry, {
        plan: email.info.plan,
        limit: email.info.limit,
        used: email.info.used,
      });
      recordAcceptMetric(telemetry, {
        durationMs: performance.now() - startedAt,
        outcome: "invalid",
      });
      return await logResponse(
        quotaExceededResponse(email.info, {
          headers: {
            "x-correlation-id": telemetry.correlationId,
            traceparent: telemetry.traceparent,
          },
        }),
      );
    }

    const createdEmail = email.email;

    if (shouldQueueNow) {
      try {
        await publishBackgroundJob(
          createBackgroundJob({
            id: `email.send:${createdEmail.id}`,
            type: "email.send",
            source: "api",
            emailId: createdEmail.id,
            trace: getTelemetryCarrier(telemetry),
          }),
          {
            deduplicationId: `email.send:${createdEmail.id}`,
            groupId: "email.send",
          },
        );
      } catch (error) {
        await auditQueuePublishFailure({
          emailId: createdEmail.id,
          userId: auth.userId,
          error,
        });
        recordTelemetryError(
          telemetry,
          "email.accept.queue_publish_failed",
          error,
          {
            email_id: createdEmail.id,
          },
        );
        throw error;
      }
    }

    const outcome = shouldQueueNow ? "queued" : "scheduled";
    const durationMs = performance.now() - startedAt;
    logTelemetry("info", "email.accepted", telemetry, {
      email_id: createdEmail.id,
      status: outcome,
      duration_ms: Math.round(durationMs),
    });
    recordAcceptMetric(telemetry, { durationMs, outcome });
    quotaReserved = false;
    return await logResponse(
      jsonWithTelemetry({ id: createdEmail.id }, telemetry),
      {
        emailId: createdEmail.id,
      },
    );
  } catch (err) {
    recordTelemetryError(telemetry, "email.accept.failed", err);
    recordAcceptMetric(telemetry, {
      durationMs: performance.now() - startedAt,
      outcome: "failed",
    });
    if (quotaReserved) {
      await releaseEmailQuota(auth.userId, 1);
    }
    return await logResponse(
      jsonWithTelemetry(
        publicApiError("internal_server_error", "Failed to send email.", 500),
        telemetry,
        { status: 500 },
      ),
    );
  }
}

// ── GET /api/emails ───────────────────────────────────────────────

export async function GET(request: Request): Promise<Response> {
  const auth = await validateApiKey(request.headers.get("authorization"));
  if (!auth || !auth.userId) return unauthorizedResponse();
  const permissionError = requireFullAccessApiKey(auth);
  if (permissionError) return permissionError;

  const url = new URL(request.url);
  const limit = Math.min(
    Math.max(Number(url.searchParams.get("limit")) || 20, 1),
    100,
  );
  const after = url.searchParams.get("after");
  const before = url.searchParams.get("before");
  const status = (
    url.searchParams.get("status") ??
    url.searchParams.get("statuses") ??
    ""
  ).trim();

  try {
    let query = db
      .select({
        id: emails.id,
        from: emails.from,
        to: emails.to,
        subject: emails.subject,
        cc: emails.cc,
        bcc: emails.bcc,
        replyTo: emails.replyTo,
        status: emails.status,
        providerRetryCount: emails.providerRetryCount,
        providerLastAttemptedAt: emails.providerLastAttemptedAt,
        providerNextRetryAt: emails.providerNextRetryAt,
        providerLastErrorCode: emails.providerLastErrorCode,
        providerLastErrorMessage: emails.providerLastErrorMessage,
        providerDeadLetteredAt: emails.providerDeadLetteredAt,
        scheduledAt: emails.scheduledAt,
        sentAt: emails.sentAt,
        createdAt: emails.createdAt,
      })
      .from(emails);

    const conditions: SQL[] = [eq(emails.userId, auth.userId)];
    if (status && status !== "all") {
      conditions.push(eq(emails.status, status));
    }
    if (after) {
      conditions.push(gt(emails.id, after));
    } else if (before) {
      conditions.push(lt(emails.id, before));
    }
    query = query.where(and(...conditions)) as typeof query;

    const results = await query
      .orderBy(desc(emails.createdAt))
      .limit(limit + 1);

    const hasMore = results.length > limit;
    const data = hasMore ? results.slice(0, limit) : results;

    return Response.json({
      object: "list",
      has_more: hasMore,
      data: data.map((e) => ({
        id: e.id,
        from: e.from,
        to: e.to,
        subject: e.subject,
        cc: e.cc,
        bcc: e.bcc,
        reply_to: e.replyTo,
        last_event: e.status,
        provider_retry_count: e.providerRetryCount,
        provider_last_attempted_at: e.providerLastAttemptedAt,
        provider_next_retry_at: e.providerNextRetryAt,
        provider_last_error: e.providerLastErrorCode
          ? {
              code: e.providerLastErrorCode,
              message: e.providerLastErrorMessage ?? "Provider send failed.",
            }
          : null,
        provider_dead_lettered_at: e.providerDeadLetteredAt,
        scheduled_at: e.scheduledAt,
        sent_at: e.sentAt,
        created_at: e.createdAt,
      })),
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to list emails";
    return Response.json({ error: message }, { status: 500 });
  }
}

// ── DELETE /api/emails ────────────────────────────────────────────

export async function DELETE(request: Request): Promise<Response> {
  const auth = await validateApiKey(request.headers.get("authorization"));
  if (!auth || !auth.userId) return unauthorizedResponse();
  const permissionError = requireFullAccessApiKey(auth);
  if (permissionError) return permissionError;

  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  if (!id) {
    return Response.json({ error: "Email id is required" }, { status: 400 });
  }

  try {
    await db
      .delete(emails)
      .where(and(eq(emails.id, id), eq(emails.userId, auth.userId)));
    return Response.json({ success: true });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to delete email";
    return Response.json({ error: message }, { status: 500 });
  }
}

// Error fallback for Zod (kept explicit for strict typing in route handlers)
export function formatZodError(error: ZodError): Record<string, unknown> {
  return zodValidationDetails(error);
}
