import { db } from "@/lib/db";
import { emailEvents, webhookDeliveries, webhooks } from "@/lib/db/schema";
import {
  type SupportedWebhookEventType,
  isSupportedWebhookEventType,
} from "@opensend/core/src/webhook-events";
import { and, eq, sql } from "drizzle-orm";

export type SystemEventType = SupportedWebhookEventType;

export interface QueueEventOptions {
  type: SystemEventType;
  userId: string;
  payload: Record<string, unknown>;
  emailId?: string;
  sourceId?: string;
}

export type QueuedWebhookEvent = {
  eventId: string;
  deliveryIds: string[];
};

/**
 * Persists a webhook event and enqueues pending deliveries for active,
 * same-tenant webhook subscriptions. Email events may include emailId; contact
 * and domain lifecycle events intentionally use the same durable event store
 * with a null email_id so the existing dispatcher can deliver them.
 */
export async function queueEvent(
  options: QueueEventOptions,
): Promise<QueuedWebhookEvent> {
  const { type, payload, emailId, sourceId, userId } = options;

  if (!isSupportedWebhookEventType(type)) {
    throw new Error(`Unsupported webhook event type: ${type}`);
  }

  return await db.transaction(async (tx) => {
    const [event] = await tx
      .insert(emailEvents)
      .values({
        emailId: emailId ?? null,
        sourceId: sourceId ?? null,
        type,
        payload,
        userId,
      })
      .returning({ id: emailEvents.id });

    const matchingWebhooks = await tx
      .select({ id: webhooks.id })
      .from(webhooks)
      .where(
        and(
          eq(webhooks.userId, userId),
          eq(webhooks.status, "active"),
          sql`${webhooks.eventTypes} ? ${type}`,
        ),
      );

    if (matchingWebhooks.length === 0) {
      return { eventId: event.id, deliveryIds: [] };
    }

    const deliveries = await tx
      .insert(webhookDeliveries)
      .values(
        matchingWebhooks.map((webhook) => ({
          webhookId: webhook.id,
          eventId: event.id,
          status: "pending",
          attempt: 0,
          nextRetryAt: null,
        })),
      )
      .returning({ id: webhookDeliveries.id });

    return {
      eventId: event.id,
      deliveryIds: deliveries.map((delivery) => delivery.id),
    };
  });
}
