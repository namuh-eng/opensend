import { and, eq, sql } from "drizzle-orm";
import { db } from "../db/client";
import { emailEvents, webhookDeliveries, webhooks } from "../db/schema";
import {
  type SupportedWebhookEventType,
  isSupportedWebhookEventType,
} from "../webhook-events";

export type DomainEventPayload = {
  id: string;
  name: string;
  status: string;
  previous_status: string;
  records: unknown[];
  capabilities: unknown[];
};

export type EnqueueDomainEventInput = {
  type: SupportedWebhookEventType;
  userId: string;
  payload: DomainEventPayload;
};

export type EnqueueDomainEventResult = {
  eventId: string;
  deliveryIds: string[];
};

export async function enqueueDomainEvent(
  input: EnqueueDomainEventInput,
): Promise<EnqueueDomainEventResult> {
  const { type, payload, userId } = input;

  if (!isSupportedWebhookEventType(type)) {
    throw new Error(`Unsupported webhook event type: ${type}`);
  }

  return await db.transaction(async (tx) => {
    const [event] = await tx
      .insert(emailEvents)
      .values({
        emailId: null,
        sourceId: null,
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
