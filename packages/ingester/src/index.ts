import {
  createBackgroundJob,
  createTelemetryContext,
  emailEventRepo,
  emitCloudWatchMetric,
  getTelemetryCarrier,
  logTelemetry,
  publishBackgroundJob,
  recordTelemetryError,
  toWebhookEventType,
  webhookRepo,
} from "@namuh/core";
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

const app = new Hono();

function isAuthorizedJobRequest(authHeader: string | undefined): boolean {
  const token = process.env.INGESTER_JOB_TOKEN?.trim();
  if (!token) return true;
  return authHeader === `Bearer ${token}`;
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

    const { data: hooks } = await webhookRepo.list({ limit: 100 });
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
