export const SUPPORTED_WEBHOOK_EVENT_TYPES = [
  "email.sent",
  "email.delivered",
  "email.bounced",
  "email.complained",
  "email.delivery_delayed",
  "email.opened",
  "email.clicked",
  "email.failed",
] as const;

export type SupportedWebhookEventType =
  (typeof SUPPORTED_WEBHOOK_EVENT_TYPES)[number];

export const SUPPORTED_WEBHOOK_EVENT_TYPE_SET: ReadonlySet<string> = new Set(
  SUPPORTED_WEBHOOK_EVENT_TYPES,
);

export function isSupportedWebhookEventType(
  value: string,
): value is SupportedWebhookEventType {
  return SUPPORTED_WEBHOOK_EVENT_TYPE_SET.has(value);
}

export function toWebhookEventType(
  eventType: string,
): SupportedWebhookEventType | null {
  const webhookEventType = eventType.includes(".")
    ? eventType
    : `email.${eventType}`;

  return isSupportedWebhookEventType(webhookEventType)
    ? webhookEventType
    : null;
}
