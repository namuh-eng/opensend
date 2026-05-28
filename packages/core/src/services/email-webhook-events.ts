import { and, eq, sql } from "drizzle-orm";
import { db } from "../db/client";
import { emailEvents, webhookDeliveries, webhooks } from "../db/schema";
import {
  type SupportedWebhookEventType,
  isSupportedWebhookEventType,
} from "../webhook-events";

export type EnqueueEmailWebhookEventInput = {
  type: SupportedWebhookEventType;
  userId: string;
  payload: Record<string, unknown>;
  emailId?: string | null;
  sourceId?: string | null;
  receivedAt?: Date;
};

export type EnqueueEmailWebhookEventResult = {
  eventId: string;
  deliveryIds: string[];
};

function toStoredEmailEventType(type: SupportedWebhookEventType): string {
  return type.startsWith("email.") ? type.slice("email.".length) : type;
}

export async function enqueueEmailWebhookEvent(
  input: EnqueueEmailWebhookEventInput,
): Promise<EnqueueEmailWebhookEventResult> {
  const { type, userId, payload, emailId, sourceId, receivedAt } = input;

  if (!type.startsWith("email.") || !isSupportedWebhookEventType(type)) {
    throw new Error(`Unsupported webhook event type: ${type}`);
  }

  return await db.transaction(async (tx) => {
    const [event] = await tx
      .insert(emailEvents)
      .values({
        emailId: emailId ?? null,
        sourceId: sourceId ?? null,
        type: toStoredEmailEventType(type),
        payload,
        userId,
        ...(receivedAt ? { receivedAt } : {}),
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
