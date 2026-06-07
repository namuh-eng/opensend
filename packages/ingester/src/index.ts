import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import {
  createBackgroundJob,
  createDomainService,
  createInboundEmailIngestionService,
  createTelemetryContext,
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
import { invalidateDomainCaches } from "./cache/domain-cache";

const domainService = createDomainService({ invalidateDomainCaches });
import { webhookDispatcher } from "./dispatcher";
import { queueWorker } from "./queue-worker";
import { Sentry } from "./sentry";
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
const inboundS3Client = new S3Client({
  region: process.env.AWS_REGION ?? "us-east-1",
});

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
  if (!token) return process.env.NODE_ENV !== "production";
  return timingSafeStringEqual(authHeader, `Bearer ${token}`);
}

function isAuthorizedInboundRequest(authHeader: string | undefined): boolean {
  const token = process.env.INGESTER_INBOUND_TOKEN?.trim();
  if (!token) return process.env.NODE_ENV !== "production";
  return timingSafeStringEqual(authHeader, `Bearer ${token}`);
}

function readStringField(
  value: Record<string, unknown>,
  key: string,
): string | null {
  const field = value[key];
  return typeof field === "string" && field.length > 0 ? field : null;
}

function readStringArrayField(
  value: Record<string, unknown>,
  key: string,
): string[] | undefined {
  const field = value[key];
  if (!Array.isArray(field)) return undefined;
  const strings = field.filter(
    (item): item is string => typeof item === "string",
  );
  return strings.length > 0 ? strings : undefined;
}

function extractSesReceiptS3Action(message: Record<string, unknown>): {
  bucketName: string;
  objectKey: string;
} {
  const receipt = message.receipt;
  if (!isRecord(receipt)) {
    throw new SnsValidationError(
      "SES receipt notification is missing receipt",
      400,
    );
  }

  const action = receipt.action;
  if (!isRecord(action)) {
    throw new SnsValidationError(
      "SES receipt notification is missing action",
      400,
    );
  }

  const actionType = readStringField(action, "type");
  const bucketName = readStringField(action, "bucketName");
  const objectKey = readStringField(action, "objectKey");
  if (actionType !== "S3" || !bucketName || !objectKey) {
    throw new SnsValidationError(
      "SES receipt notification must reference an S3 action",
      400,
    );
  }

  const expectedBucket =
    process.env.SES_INBOUND_BUCKET_NAME?.trim() ||
    process.env.S3_BUCKET_NAME?.trim();
  if (expectedBucket && bucketName !== expectedBucket) {
    throw new SnsValidationError("SES receipt S3 bucket is not allowed", 400);
  }

  return { bucketName, objectKey };
}

async function objectBodyToBuffer(body: unknown): Promise<Buffer> {
  if (!body) throw new Error("S3 object body is empty");
  if (Buffer.isBuffer(body)) return body;
  if (body instanceof Uint8Array) return Buffer.from(body);
  if (typeof body === "string") return Buffer.from(body, "utf8");
  if (
    typeof body === "object" &&
    body !== null &&
    "transformToByteArray" in body &&
    typeof body.transformToByteArray === "function"
  ) {
    return Buffer.from(await body.transformToByteArray());
  }
  if (Symbol.asyncIterator in Object(body)) {
    const chunks: Buffer[] = [];
    for await (const chunk of body as AsyncIterable<Uint8Array | string>) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }
  throw new Error("Unsupported S3 object body");
}

async function readInboundS3Object(input: {
  bucketName: string;
  objectKey: string;
}): Promise<Buffer> {
  const response = await inboundS3Client.send(
    new GetObjectCommand({ Bucket: input.bucketName, Key: input.objectKey }),
  );
  return await objectBodyToBuffer(response.Body);
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

app.get("/__sentry-test", async (c) => {
  if (c.req.header("x-sentry-smoke") !== "1") {
    return c.text("forbidden", 403);
  }
  Sentry.captureException(new Error("sentry-smoke-test:opensend-ingester"));
  await Sentry.flush(2000);
  return c.json({ ok: true });
});

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
      changes: result.changes.map((c) => ({
        id: c.domainId,
        prev: c.previousStatus,
        next: c.nextStatus,
      })),
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

app.post("/events/inbound", async (c) => {
  const telemetry = createTelemetryContext({
    service: "ingester",
    operation: "POST /events/inbound",
    headers: {
      traceparent: c.req.header("traceparent"),
      tracestate: c.req.header("tracestate"),
      "x-correlation-id": c.req.header("x-correlation-id"),
    },
  });

  if (!isAuthorizedInboundRequest(c.req.header("authorization"))) {
    return c.text("Unauthorized", 401);
  }

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json(
      { ok: false, status: "malformed_mime", reason: "Invalid JSON body" },
      400,
    );
  }

  if (!isRecord(body) || typeof body.event_id !== "string") {
    return c.json(
      {
        ok: false,
        status: "malformed_mime",
        reason: "Inbound payload requires event_id",
      },
      422,
    );
  }

  const recipients = Array.isArray(body.recipients)
    ? body.recipients.filter(
        (recipient): recipient is string => typeof recipient === "string",
      )
    : undefined;

  const metadata = isRecord(body.metadata) ? body.metadata : undefined;
  const service = createInboundEmailIngestionService();

  try {
    const outcome = await service.process({
      provider: typeof body.provider === "string" ? body.provider : "generic",
      eventId: body.event_id,
      messageId:
        typeof body.message_id === "string" ? body.message_id : undefined,
      recipients,
      rawMime: typeof body.raw_mime === "string" ? body.raw_mime : undefined,
      rawMimeBase64:
        typeof body.raw_mime_base64 === "string"
          ? body.raw_mime_base64
          : undefined,
      rawMimeUrl:
        typeof body.raw_mime_url === "string" ? body.raw_mime_url : undefined,
      metadata,
    });

    const status = outcome.status === "processed" ? 202 : 200;
    logTelemetry("info", "inbound.event.ingested", telemetry, {
      inbound_status: outcome.status,
      provider_event_id: outcome.provider_event_id,
      received_email_id:
        "received_email_id" in outcome ? outcome.received_email_id : undefined,
    });

    emitCloudWatchMetric(telemetry, {
      metrics: [{ name: "InboundEventIngested", value: 1, unit: "Count" }],
      dimensions: {
        Service: "ingester",
        Operation: "inbound.ingest",
        Outcome: outcome.status,
      },
    });

    return c.json({ ok: outcome.status === "processed", ...outcome }, status);
  } catch (error) {
    recordTelemetryError(telemetry, "inbound.ingest.failed", error);
    emitCloudWatchMetric(telemetry, {
      metrics: [{ name: "InboundEventIngestFailed", value: 1, unit: "Count" }],
      dimensions: {
        Service: "ingester",
        Operation: "inbound.ingest",
        Outcome: "failed",
      },
    });
    return c.json({ ok: false, error: "Internal Server Error" }, 500);
  }
});

app.post("/events/inbound/ses-s3", async (c) => {
  const telemetry = createTelemetryContext({
    service: "ingester",
    operation: "POST /events/inbound/ses-s3",
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
      logTelemetry(
        "info",
        "inbound.ses_s3.subscription_confirmation",
        telemetry,
        {
          sns_message_id: snsMessage.MessageId,
        },
      );
      if (snsMessage.SubscribeURL) {
        if (!isAllowedSnsSubscribeUrl(snsMessage.SubscribeURL)) {
          logTelemetry(
            "warn",
            "inbound.ses_s3.subscription_url_rejected",
            telemetry,
            {
              sns_message_id: snsMessage.MessageId,
            },
          );
        } else {
          const response = await fetch(snsMessage.SubscribeURL);
          logTelemetry(
            "info",
            "inbound.ses_s3.subscription_confirmed",
            telemetry,
            {
              sns_message_id: snsMessage.MessageId,
              confirm_status: response.status,
            },
          );
        }
      }
      return c.text("OK");
    }

    if (snsMessage.Type === "UnsubscribeConfirmation") {
      logTelemetry(
        "warn",
        "inbound.ses_s3.unsubscribe_confirmation",
        telemetry,
        {
          sns_message_id: snsMessage.MessageId,
        },
      );
      return c.text("OK");
    }

    const sesMessage = parseSesNotification(snsMessage.Message);
    const rawSesMessage = JSON.parse(snsMessage.Message) as Record<
      string,
      unknown
    >;
    const { bucketName, objectKey } = extractSesReceiptS3Action(rawSesMessage);
    const rawMime = await readInboundS3Object({ bucketName, objectKey });

    const mail = isRecord(rawSesMessage.mail) ? rawSesMessage.mail : {};
    const receipt = isRecord(rawSesMessage.receipt)
      ? rawSesMessage.receipt
      : {};
    const recipients =
      readStringArrayField(mail, "destination") ??
      readStringArrayField(receipt, "recipients");

    const outcome = await createInboundEmailIngestionService().process({
      provider: "aws-ses-receiving",
      eventId: snsMessage.MessageId,
      messageId: sesMessage.mail.messageId,
      recipients,
      rawMimeBase64: rawMime.toString("base64"),
      metadata: {
        sns_message_id: snsMessage.MessageId,
        sns_topic_arn: snsMessage.TopicArn,
        ses_event_type: sesMessage.eventType,
        ses_message_id: sesMessage.mail.messageId,
        s3_bucket: bucketName,
        s3_key: objectKey,
      },
    });

    logTelemetry("info", "inbound.ses_s3.ingested", telemetry, {
      inbound_status: outcome.status,
      provider_event_id: outcome.provider_event_id,
      received_email_id:
        "received_email_id" in outcome ? outcome.received_email_id : undefined,
      s3_bucket: bucketName,
      s3_key: objectKey,
    });

    emitCloudWatchMetric(telemetry, {
      metrics: [{ name: "InboundSesS3EventIngested", value: 1, unit: "Count" }],
      dimensions: {
        Service: "ingester",
        Operation: "inbound.ses_s3",
        Outcome: outcome.status,
      },
    });

    const status = outcome.status === "processed" ? 202 : 200;
    return c.json({ ok: outcome.status === "processed", ...outcome }, status);
  } catch (error) {
    if (error instanceof SnsValidationError) {
      recordTelemetryError(
        telemetry,
        "inbound.ses_s3.validation_failed",
        error,
      );
      return new Response(error.message, { status: error.status });
    }

    recordTelemetryError(telemetry, "inbound.ses_s3.failed", error);
    emitCloudWatchMetric(telemetry, {
      metrics: [
        { name: "InboundSesS3EventIngestFailed", value: 1, unit: "Count" },
      ],
      dimensions: {
        Service: "ingester",
        Operation: "inbound.ses_s3",
        Outcome: "failed",
      },
    });
    return new Response("Internal Server Error", { status: 500 });
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
