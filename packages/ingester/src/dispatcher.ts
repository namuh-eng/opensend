import {
  emailEventRepo,
  signWebhookPayload,
  toWebhookEventType,
  webhookDeliveryRepo,
  webhookRepo,
} from "@namuh/core";

const DEFAULT_RETRY_DELAYS_SECONDS = [10, 60, 300, 1800, 7200, 21600, 86400];
const DEFAULT_TIMEOUT_MS = 5_000;
const DEFAULT_MAX_ATTEMPTS = DEFAULT_RETRY_DELAYS_SECONDS.length + 1;
const RESPONSE_BODY_SNIPPET_LIMIT = 1_000;

type WebhookDispatcherOptions = {
  fetchImpl?: typeof fetch;
  now?: () => Date;
  retryDelaysSeconds?: number[];
  maxAttempts?: number;
  timeoutMs?: number;
};

export class WebhookDispatcher {
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => Date;
  private readonly retryDelaysSeconds: number[];
  private readonly maxAttempts: number;
  private readonly timeoutMs: number;

  constructor(options: WebhookDispatcherOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.now = options.now ?? (() => new Date());
    this.retryDelaysSeconds =
      options.retryDelaysSeconds ?? DEFAULT_RETRY_DELAYS_SECONDS;
    this.maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async enqueue(webhookId: string, eventId: string) {
    return await webhookDeliveryRepo.create({
      webhookId,
      eventId,
      status: "pending",
      attempt: 0,
      nextRetryAt: null,
    });
  }

  async dispatchDelivery(deliveryId: string) {
    const delivery = await webhookDeliveryRepo.findById(deliveryId);
    if (!delivery) return null;

    const [webhook, event] = await Promise.all([
      webhookRepo.findById(delivery.webhookId),
      emailEventRepo.findById(delivery.eventId),
    ]);

    if (!webhook) {
      return await this.markTerminal(delivery, "Webhook not found");
    }

    if (webhook.status !== "active") {
      return await this.markTerminal(delivery, "Webhook is disabled");
    }

    if (!event) {
      return await this.markTerminal(delivery, "Webhook event not found");
    }

    const attemptedAt = this.now();
    const attemptNumber = delivery.attempt + 1;
    const timestamp = Math.floor(attemptedAt.getTime() / 1000).toString();
    const msgId = `whd_${delivery.id}_${attemptNumber}`;
    const eventType = toWebhookEventType(String(event.type));
    if (!eventType) {
      return await this.markTerminal(
        delivery,
        `Unsupported webhook event type: ${String(event.type)}`,
      );
    }

    const body = JSON.stringify({
      id: msgId,
      type: eventType,
      created_at: attemptedAt.toISOString(),
      data: event.payload,
    });

    const signature = signWebhookPayload(
      webhook.signingSecret || "",
      msgId,
      timestamp,
      body,
    );

    try {
      const response = await this.fetchImpl(webhook.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "svix-id": msgId,
          "svix-timestamp": timestamp,
          "svix-signature": signature,
        },
        body,
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      const responseBody = this.toSnippet(await response.text());
      const nextRetryAt = response.ok
        ? null
        : this.calculateNextRetry(attemptNumber);
      const nextStatus = response.ok
        ? "success"
        : attemptNumber >= this.maxAttempts
          ? "dead_letter"
          : "pending";

      return await webhookDeliveryRepo.update(delivery.id, {
        attempt: attemptNumber,
        attemptedAt,
        statusCode: response.status,
        responseBody,
        status: nextStatus,
        nextRetryAt: nextStatus === "pending" ? nextRetryAt : null,
      });
    } catch (error) {
      const message = this.toSnippet(
        error instanceof Error ? error.message : String(error),
      );
      const nextStatus =
        attemptNumber >= this.maxAttempts ? "dead_letter" : "pending";

      return await webhookDeliveryRepo.update(delivery.id, {
        attempt: attemptNumber,
        attemptedAt,
        responseBody: message,
        statusCode: null,
        status: nextStatus,
        nextRetryAt:
          nextStatus === "pending"
            ? this.calculateNextRetry(attemptNumber)
            : null,
      });
    }
  }

  async dispatchPendingDeliveries(
    options: { limit?: number; now?: Date } = {},
  ) {
    const deliveries = await webhookDeliveryRepo.findDispatchable(options);

    const results = [];
    for (const delivery of deliveries) {
      const result = await this.dispatchDelivery(delivery.id);
      if (result) {
        results.push(result);
      }
    }

    return {
      processed: results.length,
      results,
    };
  }

  private calculateNextRetry(attemptNumber: number): Date {
    const seconds =
      this.retryDelaysSeconds[attemptNumber - 1] ??
      this.retryDelaysSeconds[this.retryDelaysSeconds.length - 1] ??
      86_400;

    return new Date(this.now().getTime() + seconds * 1_000);
  }

  private async markTerminal(
    delivery: {
      id: string;
      attempt: number;
    },
    message: string,
  ) {
    return await webhookDeliveryRepo.update(delivery.id, {
      attempt: delivery.attempt,
      status: "failed",
      responseBody: this.toSnippet(message),
      statusCode: null,
      nextRetryAt: null,
    });
  }

  private toSnippet(value: string) {
    return value.length > RESPONSE_BODY_SNIPPET_LIMIT
      ? `${value.slice(0, RESPONSE_BODY_SNIPPET_LIMIT)}…`
      : value;
  }
}

export const webhookDispatcher = new WebhookDispatcher();
