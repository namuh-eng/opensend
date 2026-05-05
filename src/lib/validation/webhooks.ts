import {
  SUPPORTED_WEBHOOK_EVENT_TYPES,
  type SupportedWebhookEventType,
} from "@opensend/core/src/webhook-events";
import { z } from "zod";

export const webhookStatusSchema = z.enum(["active", "disabled"]);

const supportedWebhookEventTypeSchema = z.enum(SUPPORTED_WEBHOOK_EVENT_TYPES, {
  message: "Unsupported webhook event type",
});

const webhookEventTypesSchema = z
  .array(supportedWebhookEventTypeSchema)
  .min(1)
  .transform((events) => Array.from(new Set(events)));

export const createWebhookSchema = z
  .object({
    endpoint: z.string().url().max(2048).optional(),
    url: z.string().url().max(2048).optional(),
    events: webhookEventTypesSchema.optional(),
    event_types: webhookEventTypesSchema.optional(),
  })
  .refine(
    (data) => (data.endpoint || data.url) && (data.events || data.event_types),
    {
      message: "Endpoint and events are required",
    },
  );

export const updateWebhookSchema = z.object({
  endpoint: z.string().url().max(2048).optional(),
  url: z.string().url().max(2048).optional(),
  events: webhookEventTypesSchema.optional(),
  event_types: webhookEventTypesSchema.optional(),
  status: z.enum(["enabled", "disabled"]).optional(),
  active: z.boolean().optional(),
});

export type CreateWebhookRequest = z.infer<typeof createWebhookSchema>;
export type UpdateWebhookRequest = z.infer<typeof updateWebhookSchema>;
export type WebhookEventType = SupportedWebhookEventType;
