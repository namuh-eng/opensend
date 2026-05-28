import {
  getApiKeyAuthHeaderError,
  publicApiKeyUnauthorizedResponse,
  validateApiKey,
} from "@/lib/api-auth";
import { requireAllowedSendingDomain } from "@/lib/api-key-permissions";
import { captureApiResponseLog } from "@/lib/api-logging";
import { getIdempotencyWindowStart } from "@/lib/api/emails/idempotency";
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
  StoredTemplateRendererConfigError,
  getStoredTemplateRendererConfig,
  renderStoredTemplateContent,
  resolveStoredTemplateRenderVariables,
} from "@/lib/templates/stored-renderer";
import {
  buildOneClickUnsubscribeHeaders,
  createUnsubscribeUrl,
  getPublicBaseUrl,
  hasUnsubscribePlaceholder,
  replaceUnsubscribePlaceholder,
} from "@/lib/unsubscribe";
import {
  TemplateRendererError,
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
  publicApiError,
  publishBackgroundJob,
  recordTelemetryError,
  sendEmailSchema,
  zodValidationDetails,
} from "@opensend/core";
import { and, eq, gte, lt } from "drizzle-orm";

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

function templateRenderApiFailureMessage(error: unknown): string | null {
  if (error instanceof TemplateRendererError) {
    return error.message;
  }
  if (error instanceof StoredTemplateRendererConfigError) {
    return error.message;
  }
  return null;
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

// ── POST /api/emails ──────────────────────────────────────────────

export async function handlePostEmailRequest(
  request: Request,
): Promise<Response> {
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
    recordAcceptMetric(telemetry, {
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
  const idempotencyWindowStart = getIdempotencyWindowStart();

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
        eq(emails.userId, userId),
        gte(emails.createdAt, idempotencyWindowStart),
      ),
    });
    if (existing) {
      recordAcceptMetric(telemetry, {
        durationMs: performance.now() - startedAt,
        outcome: "queued",
      });
      return await logResponse(
        jsonWithTelemetry({ id: existing.id }, telemetry, { status: 200 }),
        { emailId: existing.id },
      );
    }
  }

  const to = normalizeEmailRecipient(validated.to) as string[];
  const cc = normalizeEmailRecipient(validated.cc);
  const bcc = normalizeEmailRecipient(validated.bcc);
  const replyTo = normalizeEmailRecipient(validated.reply_to);
  const scheduledAt = validated.scheduled_at
    ? normalizeScheduledAt(validated.scheduled_at)
    : null;

  const sandboxRecipients = getSandboxRecipientsForMessage({ to, cc, bcc });
  const sandboxOutcome = getSandboxTestOutcomeForRecipients(sandboxRecipients);
  if (hasSandboxTestRecipient(sandboxRecipients) && !sandboxOutcome) {
    recordAcceptMetric(telemetry, {
      durationMs: performance.now() - startedAt,
      outcome: "invalid",
    });
    return await logResponse(
      jsonWithTelemetry(sandboxMixedRecipientError(), telemetry, {
        status: 422,
      }),
    );
  }

  const sandboxSuppressedRecipients =
    findSandboxSuppressedRecipients(sandboxRecipients);
  if (sandboxSuppressedRecipients.length > 0) {
    await emitSuppressedWebhook({
      userId: auth.userId,
      recipients: sandboxSuppressedRecipients.map((email) => ({
        email,
        reason: "suppressed",
      })),
    });
    recordAcceptMetric(telemetry, {
      durationMs: performance.now() - startedAt,
      outcome: "invalid",
    });
    return await logResponse(
      jsonWithTelemetry(
        sandboxSuppressedRecipientError(sandboxSuppressedRecipients),
        telemetry,
        {
          status: 422,
        },
      ),
    );
  }

  const suppressedRecipients = await findSuppressedRecipients({
    userId: auth.userId,
    recipients: to,
  });
  if (suppressedRecipients.length > 0) {
    await emitSuppressedWebhook({
      userId: auth.userId,
      recipients: suppressedRecipients.map((entry) => ({
        email: entry.email,
        reason: entry.reason,
      })),
    });
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

      const providedVars = validated.template.variables ?? {};
      const renderVariableResult = resolveStoredTemplateRenderVariables({
        storedVariables: template.variables,
        providedVariables: providedVars,
        mode: "send",
      });

      if (!renderVariableResult.ok) {
        recordAcceptMetric(telemetry, {
          durationMs: performance.now() - startedAt,
          outcome: "invalid",
        });
        return await logResponse(
          jsonWithTelemetry(
            publicApiError(
              "validation_error",
              `Missing required template variable: ${renderVariableResult.missingRequiredKey}`,
              422,
              {
                formErrors: [],
                fieldErrors: {
                  template: [
                    `Missing required variable: ${renderVariableResult.missingRequiredKey}`,
                  ],
                },
              },
            ),
            telemetry,
            { status: 422 },
          ),
        );
      }

      try {
        const rendererConfig = getStoredTemplateRendererConfig(
          template.document,
        );
        const storedSubject =
          typeof template.subject === "string" && template.subject.length > 0
            ? template.subject
            : null;
        const renderedTemplate = await renderStoredTemplateContent({
          template,
          subject:
            storedSubject ??
            (rendererConfig.kind === "legacy" ? finalSubject : undefined),
          variables: renderVariableResult.variables,
        });
        finalHtml = renderedTemplate.html;
        finalText = renderedTemplate.text;
        finalSubject = renderedTemplate.subject;
      } catch (error) {
        const message = templateRenderApiFailureMessage(error);
        if (!message) throw error;

        recordAcceptMetric(telemetry, {
          durationMs: performance.now() - startedAt,
          outcome: "invalid",
        });
        return await logResponse(
          jsonWithTelemetry(
            publicApiError("validation_error", message, 422, {
              formErrors: [],
              fieldErrors: { template: [message] },
            }),
            telemetry,
            { status: 422 },
          ),
        );
      }
    }

    const shouldQueueNow = !scheduledAt || scheduledAt <= new Date();

    // Quota gate: post-validation and committed in the same transaction as the
    // durable email row. SQS publish remains after commit so workers can read it.
    const email = await db.transaction(async (tx) => {
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

    if (!shouldQueueNow && scheduledAt) {
      quotaReserved = false;
      await emitScheduledWebhook({
        userId: auth.userId,
        emailId: createdEmail.id,
        scheduledAt,
        recipientCount: to.length,
      });
    }

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
