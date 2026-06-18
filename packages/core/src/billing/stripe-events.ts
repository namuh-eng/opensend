import type { SubscriptionStatus } from "../dto";

export type StripeWebhookEventType =
  | "checkout.session.completed"
  | "customer.subscription.created"
  | "customer.subscription.updated"
  | "customer.subscription.deleted"
  | "invoice.paid"
  | "invoice.payment_failed";

export const SUPPORTED_STRIPE_EVENT_TYPES: ReadonlyArray<StripeWebhookEventType> =
  [
    "checkout.session.completed",
    "customer.subscription.created",
    "customer.subscription.updated",
    "customer.subscription.deleted",
    "invoice.paid",
    "invoice.payment_failed",
  ];

export function isSupportedStripeEventType(
  type: string,
): type is StripeWebhookEventType {
  return (SUPPORTED_STRIPE_EVENT_TYPES as ReadonlyArray<string>).includes(type);
}

const STRIPE_STATUS_MAP: Record<string, SubscriptionStatus> = {
  active: "active",
  trialing: "trialing",
  past_due: "past_due",
  canceled: "canceled",
  cancelled: "canceled",
  incomplete: "incomplete",
  incomplete_expired: "incomplete_expired",
  unpaid: "unpaid",
  paused: "paused",
};

export function normalizeStripeSubscriptionStatus(
  status: string | null | undefined,
): SubscriptionStatus | null {
  if (!status) return null;
  return STRIPE_STATUS_MAP[status] ?? null;
}

export function epochSecondsToDate(value: unknown): Date | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return null;
  }
  return new Date(value * 1_000);
}

type StripeSubscriptionLike = {
  id?: string;
  status?: string;
  customer?: string;
  current_period_start?: number;
  current_period_end?: number;
  cancel_at_period_end?: boolean;
  items?: {
    data?: Array<{ price?: { id?: string } | null }>;
  };
  metadata?: Record<string, string>;
};

export type ParsedStripeSubscription = {
  stripeSubscriptionId: string;
  stripeCustomerId: string;
  status: SubscriptionStatus | null;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  stripePriceId: string | null;
  stripePriceIds: string[];
  metadata: Record<string, string>;
};

export class StripeEventParseError extends Error {
  readonly code: "missing_field" | "wrong_type";
  constructor(code: "missing_field" | "wrong_type", message: string) {
    super(message);
    this.code = code;
    this.name = "StripeEventParseError";
  }
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new StripeEventParseError(
      "missing_field",
      `Stripe event payload missing string field: ${field}`,
    );
  }
  return value;
}

export function parseStripeSubscriptionObject(
  raw: unknown,
): ParsedStripeSubscription {
  if (!raw || typeof raw !== "object") {
    throw new StripeEventParseError(
      "wrong_type",
      "Stripe subscription object is not an object",
    );
  }
  const obj = raw as StripeSubscriptionLike;

  const stripeSubscriptionId = requireString(obj.id, "id");
  const stripeCustomerId = requireString(obj.customer, "customer");
  const status = normalizeStripeSubscriptionStatus(obj.status ?? null);
  const currentPeriodStart = epochSecondsToDate(obj.current_period_start);
  const currentPeriodEnd = epochSecondsToDate(obj.current_period_end);
  const cancelAtPeriodEnd = Boolean(obj.cancel_at_period_end);
  const stripePriceIds = Array.from(
    new Set(
      (obj.items?.data ?? [])
        .map((item) => item.price?.id?.toString() ?? "")
        .filter((priceId) => priceId.trim() !== ""),
    ),
  );
  const stripePriceId = stripePriceIds[0] ?? null;
  const metadata =
    obj.metadata && typeof obj.metadata === "object"
      ? (obj.metadata as Record<string, string>)
      : {};

  return {
    stripeSubscriptionId,
    stripeCustomerId,
    status,
    currentPeriodStart,
    currentPeriodEnd,
    cancelAtPeriodEnd,
    stripePriceId,
    stripePriceIds,
    metadata,
  };
}

type StripeCheckoutSessionLike = {
  id?: string;
  mode?: string;
  customer?: string;
  subscription?: string;
  client_reference_id?: string | null;
  metadata?: Record<string, string>;
};

export type ParsedStripeCheckoutSession = {
  sessionId: string;
  mode: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  clientReferenceId: string | null;
  metadata: Record<string, string>;
};

export function parseStripeCheckoutSession(
  raw: unknown,
): ParsedStripeCheckoutSession {
  if (!raw || typeof raw !== "object") {
    throw new StripeEventParseError(
      "wrong_type",
      "Stripe checkout session object is not an object",
    );
  }
  const obj = raw as StripeCheckoutSessionLike;
  const sessionId = requireString(obj.id, "id");
  const mode = typeof obj.mode === "string" ? obj.mode : "";
  const stripeCustomerId =
    typeof obj.customer === "string" && obj.customer ? obj.customer : null;
  const stripeSubscriptionId =
    typeof obj.subscription === "string" && obj.subscription
      ? obj.subscription
      : null;
  const clientReferenceId =
    typeof obj.client_reference_id === "string" && obj.client_reference_id
      ? obj.client_reference_id
      : null;
  const metadata =
    obj.metadata && typeof obj.metadata === "object"
      ? (obj.metadata as Record<string, string>)
      : {};

  return {
    sessionId,
    mode,
    stripeCustomerId,
    stripeSubscriptionId,
    clientReferenceId,
    metadata,
  };
}

type StripeInvoiceLike = {
  id?: string;
  customer?: string;
  subscription?: string | null;
  hosted_invoice_url?: string | null;
  amount_due?: number;
  status?: string;
};

export type ParsedStripeInvoice = {
  invoiceId: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string | null;
  hostedInvoiceUrl: string | null;
  amountDueCents: number;
  status: string;
};

export function parseStripeInvoiceObject(raw: unknown): ParsedStripeInvoice {
  if (!raw || typeof raw !== "object") {
    throw new StripeEventParseError(
      "wrong_type",
      "Stripe invoice object is not an object",
    );
  }
  const obj = raw as StripeInvoiceLike;
  const invoiceId = requireString(obj.id, "id");
  const stripeCustomerId = requireString(obj.customer, "customer");
  const stripeSubscriptionId =
    typeof obj.subscription === "string" && obj.subscription
      ? obj.subscription
      : null;
  const hostedInvoiceUrl =
    typeof obj.hosted_invoice_url === "string" ? obj.hosted_invoice_url : null;
  const amountDueCents =
    typeof obj.amount_due === "number" && Number.isFinite(obj.amount_due)
      ? obj.amount_due
      : 0;
  const status = typeof obj.status === "string" ? obj.status : "";

  return {
    invoiceId,
    stripeCustomerId,
    stripeSubscriptionId,
    hostedInvoiceUrl,
    amountDueCents,
    status,
  };
}
