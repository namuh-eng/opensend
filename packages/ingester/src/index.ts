import {
  createBackgroundJob,
  createTelemetryContext,
  domainService,
  emailEventRepo,
  emailService,
  emitCloudWatchMetric,
  enqueueDomainEvent,
  getTelemetryCarrier,
  logTelemetry,
  publishBackgroundJob,
  recordTelemetryError,
  suppressionRepo,
  timingSafeStringEqual,
  toWebhookEventType,
  webhookRepo,
} from "@opensend/core";
import { Hono } from "hono";
import { webhookDispatcher } from "./dispatcher";
import { queueWorker } from "./queue-worker";
import { normalizeSesEvent } from "./ses-event-normalization";
import {
  SnsValidationError,
  extractEmailId,
  parseSesNotification,
  parseSnsEnvelope,
  verifySnsSignature,
} from "./sns-message";
import { isAllowedSnsSubscribeUrl } from "./sns-subscribe-url";
import {
  StripeWebhookProcessor,
  buildPaymentFailedEmail,
} from "./stripe-webhook";

const app = new Hono();

type SesSuppressionOutcome = {
  reason: "bounced" | "complained";
  recipients: string[];
  metadata: { bounceType?: string; complaintFeedbackType?: string };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readRecipientEmails(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((recipient) => {
      if (!isRecord(recipient)) return null;
      const emailAddress = recipient.emailAddress;
      return typeof emailAddress === "string" && emailAddress.length > 0
        ? emailAddress
        : null;
    })
    .filter((email): email is string => Boolean(email));
}

function getSesSuppressionOutcome(
  eventType: string,
  payload: unknown,
): SesSuppressionOutcome | null {
  if (!isRecord(payload)) return null;

  if (eventType === "Bounce") {
    const bounceType = payload.bounceType;
    if (bounceType !== "Permanent") return null;
    return {
      reason: "bounced",
      recipients: readRecipientEmails(payload.bouncedRecipients),
      metadata: { bounceType },
    };
  }

  if (eventType === "Complaint") {
    const complaintFeedbackType = payload.complaintFeedbackType;
    return {
      reason: "complained",
      recipients: readRecipientEmails(payload.complainedRecipients),
      metadata:
        typeof complaintFeedbackType === "string"
          ? { complaintFeedbackType }
          : {},
    };
  }

  return null;
}

function isAuthorizedJobRequest(authHeader: string | undefined): boolean {
  const token = process.env.INGESTER_JOB_TOKEN?.trim();
  if (!token) return true;
  return timingSafeStringEqual(authHeader, `Bearer ${token}`);
}

async function runJobEndpoint<T>(
  c: {
    req: { header: (name: string) => string | undefined };
    json: (data: T, status?: number) => Response;
    text: (body: string, status?: number) => Response;
  },
  action: () => Promise<T>,
) {
  if (!isAuthorizedJobRequest(c.req.header("authorization"))) {
    return c.text("Unauthorized", 401);
  }
  return c.json(await action());
}

app.get("/health", (c) => c.text("OK"));

app.post("/jobs/poll", async (c) =>
  runJobEndpoint(c, async () => await queueWorker.pollOnce()),
);

app.post("/jobs/scheduled-emails", async (c) =>
  runJobEndpoint(c, async () => await queueWorker.processDueScheduledEmails()),
);

app.post("/jobs/webhooks", async (c) =>
  runJobEndpoint(
    c,
    async () => await webhookDispatcher.dispatchPendingDeliveries(),
  ),
);

app.post("/jobs/domain-verify", async (c) =>
  runJobEndpoint(c, async () => {
    const telemetry = createTelemetryContext({
      service: "ingester",
      operation: "POST /jobs/domain-verify",
    });

    let result: Awaited<
      ReturnType<typeof domainService.reconcileAllPendingVerifications>
    >;
    try {
      result = await domainService.reconcileAllPendingVerifications();
    } catch (error) {
      recordTelemetryError(telemetry, "domain.verify.reconcile_failed", error);
      throw error;
    }

    for (const change of result.changes) {
      if (!change.userId) continue;
      try {
        await enqueueDomainEvent({
          type: "domain.updated",
          userId: change.userId,
          payload: {
            id: change.domainId,
            name: change.domainName,
            status: change.nextStatus,
            previous_status: change.previousStatus,
            records: change.records,
            capabilities: change.capabilities,
          },
        });
      } catch (error) {
        recordTelemetryError(
          telemetry,
          "domain.verify.event_enqueue_failed",
          error,
          { domain_id: change.domainId },
        );
      }
    }

    logTelemetry("info", "domain.verify.reconcile_completed", telemetry, {
      scanned: result.scanned,
      updated: result.updated,
      unchanged: result.unchanged,
      failed: result.failed,
    });

    emitCloudWatchMetric(telemetry, {
      metrics: [
        { name: "DomainVerifyScanned", value: result.scanned, unit: "Count" },
        { name: "DomainVerifyUpdated", value: result.updated, unit: "Count" },
        { name: "DomainVerifyFailed", value: result.failed, unit: "Count" },
      ],
      dimensions: {
        Service: "ingester",
        Operation: "domain.verify.reconcile",
      },
    });

    return {
      scanned: result.scanned,
      updated: result.updated,
      unchanged: result.unchanged,
      failed: result.failed,
    };
  }),
);

app.post("/webhooks/stripe", async (c) => {
  const telemetry = createTelemetryContext({
    service: "ingester",
    operation: "POST /webhooks/stripe",
    headers: {
      traceparent: c.req.header("traceparent"),
      tracestate: c.req.header("tracestate"),
      "x-correlation-id": c.req.header("x-correlation-id"),
    },
  });

  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret) {
    logTelemetry("warn", "stripe.webhook.secret_missing", telemetry);
    return c.text("Stripe webhook secret not configured", 503);
  }

  const notificationFrom =
    process.env.BILLING_NOTIFICATION_FROM_EMAIL?.trim() ?? null;

  const processor = new StripeWebhookProcessor({
    secret,
    notificationFrom,
    deps: {
      emailNotifier: notificationFrom
        ? async ({ to, invoice }) => {
            const built = buildPaymentFailedEmail({ invoice });
            await emailService.send({
              from: notificationFrom,
              to: [to],
              subject: built.subject,
              html: built.html,
              text: built.text,
              tags: [
                { name: "namuh:source", value: "billing" },
                { name: "namuh:reason", value: "invoice_payment_failed" },
              ],
              idempotencyKey: `stripe:invoice_payment_failed:${invoice.invoiceId}`,
            });
          }
        : undefined,
      log: (level, event, fields) =>
        logTelemetry(level, event, telemetry, fields),
    },
  });

  let rawBody: string;
  try {
    rawBody = await c.req.text();
  } catch (error) {
    recordTelemetryError(telemetry, "stripe.webhook.body_read_failed", error);
    return c.text("Invalid request body", 400);
  }

  try {
    const outcome = await processor.process({
      rawBody,
      signatureHeader: c.req.header("stripe-signature"),
    });

    emitCloudWatchMetric(telemetry, {
      metrics: [{ name: "StripeWebhookEvent", value: 1, unit: "Count" }],
      dimensions: {
        Service: "ingester",
        Operation: "stripe.webhook",
        Outcome: outcome.status,
      },
    });

    if (outcome.status === "rejected") {
      return c.text(outcome.reason, outcome.httpStatus);
    }
    return c.json({
      ok: true,
      status: outcome.status,
      event_id: "eventId" in outcome ? outcome.eventId : null,
      type: "type" in outcome ? outcome.type : null,
    });
  } catch (error) {
    recordTelemetryError(telemetry, "stripe.webhook.failed", error);
    emitCloudWatchMetric(telemetry, {
      metrics: [{ name: "StripeWebhookFailed", value: 1, unit: "Count" }],
      dimensions: {
        Service: "ingester",
        Operation: "stripe.webhook",
        Outcome: "error",
      },
    });
    return c.text("Internal Server Error", 500);
  }
});

app.post("/events/ses", async (c) => {
  const telemetry = createTelemetryContext({
    service: "ingester",
    operation: "POST /events/ses",
    headers: {
      traceparent: c.req.header("traceparent"),
      tracestate: c.req.header("tracestate"),
      "x-correlation-id": c.req.header("x-correlation-id"),
    },
  });

  try {
    const body = await c.req.json();
    const snsType = c.req.header("x-amz-sns-message-type");
    const snsMessage = parseSnsEnvelope(body, snsType);

    await verifySnsSignature(snsMessage);

    if (snsMessage.Type === "SubscriptionConfirmation") {
      logTelemetry("info", "ses.sns.subscription_confirmation", telemetry, {
        sns_message_id: snsMessage.MessageId,
      });
      if (snsMessage.SubscribeURL) {
        if (!isAllowedSnsSubscribeUrl(snsMessage.SubscribeURL)) {
          logTelemetry("warn", "ses.sns.subscription_url_rejected", telemetry, {
            sns_message_id: snsMessage.MessageId,
          });
        } else {
          try {
            const r = await fetch(snsMessage.SubscribeURL);
            logTelemetry("info", "ses.sns.subscription_confirmed", telemetry, {
              sns_message_id: snsMessage.MessageId,
              confirm_status: r.status,
            });
          } catch (err) {
            logTelemetry(
              "error",
              "ses.sns.subscription_confirm_failed",
              telemetry,
              {
                sns_message_id: snsMessage.MessageId,
                error: err instanceof Error ? err.message : String(err),
              },
            );
          }
        }
      }
      return c.text("OK");
    }

    if (snsMessage.Type === "UnsubscribeConfirmation") {
      logTelemetry("warn", "ses.sns.unsubscribe_confirmation", telemetry, {
        sns_message_id: snsMessage.MessageId,
      });
      return c.text("OK");
    }

    const sesMessage = parseSesNotification(snsMessage.Message);
    const sesId = sesMessage.mail.messageId;
    const eventType = sesMessage.eventType;
    const normalizedEvent = normalizeSesEvent(eventType);

    logTelemetry("info", "ses.event.received", telemetry, {
      ses_message_id: sesId,
      ses_event_type: eventType,
    });

    if (!normalizedEvent) {
      logTelemetry("warn", "ses.event.unsupported", telemetry, {
        ses_message_id: sesId,
        ses_event_type: eventType,
      });
      return c.text("OK");
    }

    const emailId = extractEmailId(sesMessage);

    if (!emailId) {
      logTelemetry("warn", "ses.event.missing_email_id", telemetry, {
        ses_message_id: sesId,
        ses_event_type: eventType,
      });
      return c.text("OK");
    }

    const { event, created } = await emailEventRepo.createOrIgnoreDuplicate({
      emailId,
      sourceId: snsMessage.MessageId,
      type: normalizedEvent.type,
      payload: sesMessage[normalizedEvent.payloadKey] || sesMessage,
    });

    if (!created) {
      logTelemetry("info", "ses.event.duplicate", telemetry, {
        sns_message_id: snsMessage.MessageId,
        email_id: emailId,
      });
      return c.text("OK");
    }

    const suppressionOutcome = getSesSuppressionOutcome(
      eventType,
      sesMessage[normalizedEvent.payloadKey],
    );
    if (suppressionOutcome) {
      const suppressions = await suppressionRepo.suppressFromSesEvent({
        emailId,
        recipients: suppressionOutcome.recipients,
        reason: suppressionOutcome.reason,
        sourceEventId: snsMessage.MessageId,
        sourceMessageId: sesId,
        metadata: suppressionOutcome.metadata,
      });
      logTelemetry("info", "ses.suppressions.refreshed", telemetry, {
        email_id: emailId,
        reason: suppressionOutcome.reason,
        suppression_count: suppressions.length,
      });
    }

    emitCloudWatchMetric(telemetry, {
      metrics: [{ name: "SesEventIngested", value: 1, unit: "Count" }],
      dimensions: {
        Service: "ingester",
        Operation: "ses.ingest",
        EventType: event.type,
        Outcome: "created",
      },
    });

    const webhookEventType = toWebhookEventType(event.type);
    if (!webhookEventType) {
      return c.text("OK");
    }

    const { data: hooks } = await webhookRepo.listForDispatch({ limit: 100 });
    for (const hook of hooks) {
      const types = hook.eventTypes as string[];
      if (hook.status === "active" && types.includes(webhookEventType)) {
        const delivery = await webhookDispatcher.enqueue(hook.id, event.id);
        await publishBackgroundJob(
          createBackgroundJob({
            id: `webhook.dispatch:${delivery.id}`,
            type: "webhook.dispatch",
            source: "ses-ingest",
            deliveryId: delivery.id,
            trace: getTelemetryCarrier(telemetry),
          }),
          {
            deduplicationId: `webhook.dispatch:${delivery.id}`,
            groupId: "webhook.dispatch",
          },
        );
      }
    }

    return c.text("OK");
  } catch (error) {
    if (error instanceof SnsValidationError) {
      recordTelemetryError(telemetry, "ses.sns.validation_failed", error);
      return new Response(error.message, { status: error.status });
    }

    recordTelemetryError(telemetry, "ses.ingest.failed", error);
    emitCloudWatchMetric(telemetry, {
      metrics: [{ name: "SesEventIngestFailed", value: 1, unit: "Count" }],
      dimensions: {
        Service: "ingester",
        Operation: "ses.ingest",
        Outcome: "failed",
      },
    });
    return new Response("Internal Server Error", { status: 500 });
  }
});

export default app;
