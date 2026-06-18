import {
  type ParsedStripeCheckoutSession,
  type ParsedStripeInvoice,
  type ParsedStripeSubscription,
  StripeEventParseError,
  StripeSignatureError,
  type StripeWebhookEventType,
  type SubscriptionStatus,
  constructStripeEvent,
  isSupportedStripeEventType,
  parseStripeCheckoutSession,
  parseStripeInvoiceObject,
  parseStripeSubscriptionObject,
  planRepo,
  stripeCustomerRepo,
  stripeEventRepo,
  subscriptionRepo,
} from "@opensend/core";
import { db, user } from "@opensend/core";
import { eq } from "drizzle-orm";

export type StripeWebhookOutcome =
  | { status: "rejected"; httpStatus: 400; reason: string }
  | { status: "duplicate"; eventId: string; type: string }
  | { status: "ignored"; eventId: string; type: string }
  | { status: "skipped"; eventId: string; type: string; reason: string }
  | {
      status: "processed";
      eventId: string;
      type: StripeWebhookEventType;
      details: Record<string, unknown>;
    };

type StripeEventEnvelope = {
  id?: string;
  type?: string;
  data?: { object?: unknown };
};

type StripeEventStore = {
  markProcessed: (
    eventId: string,
    type: string,
  ) => Promise<{ created: boolean }>;
  deleteProcessed?: (eventId: string) => Promise<void>;
};

type StripeCustomerStore = {
  ensureForUser: (userId: string, stripeCustomerId: string) => Promise<unknown>;
  findByStripeCustomerId: (
    stripeCustomerId: string,
  ) => Promise<{ userId: string } | undefined | null>;
};

type PlanStore = {
  list: () => Promise<Array<{ id: string; stripePriceId: string | null }>>;
  ensureFreePlan: () => Promise<{ id: string } | undefined | null>;
};

type SubscriptionRow = {
  id: string;
  userId: string;
  status: string;
};

type SubscriptionUpsertData = {
  planId: string;
  status: SubscriptionStatus;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  stripeSubscriptionId: string;
};

type SubscriptionUpdateData = Partial<SubscriptionUpsertData>;

type SubscriptionStore = {
  findByStripeSubscriptionId: (
    stripeSubscriptionId: string,
  ) => Promise<SubscriptionRow | undefined | null>;
  update: (id: string, data: SubscriptionUpdateData) => Promise<unknown>;
  upsertByUserId: (
    userId: string,
    data: SubscriptionUpsertData,
  ) => Promise<unknown>;
};

export type StripeWebhookProcessorDeps = {
  emailNotifier?: (input: {
    to: string;
    userId: string;
    invoice: ParsedStripeInvoice;
  }) => Promise<void>;
  stripeEventStore?: StripeEventStore;
  stripeCustomerStore?: StripeCustomerStore;
  planStore?: PlanStore;
  subscriptionStore?: SubscriptionStore;
  resolveUserEmail?: (userId: string) => Promise<string | null>;
  log?: (
    level: "info" | "warn" | "error",
    event: string,
    fields?: Record<string, unknown>,
  ) => void;
};

const noopLog: NonNullable<StripeWebhookProcessorDeps["log"]> = () => {};

async function defaultResolveUserEmail(userId: string): Promise<string | null> {
  const row = await db.query.user.findFirst({
    where: eq(user.id, userId),
  });
  return row?.email ?? null;
}

export class StripeWebhookProcessor {
  private readonly secret: string;
  private readonly toleranceSeconds: number;
  private readonly notificationFrom: string | null;
  private readonly emailNotifier: StripeWebhookProcessorDeps["emailNotifier"];
  private readonly stripeEventStore: StripeEventStore;
  private readonly stripeCustomerStore: StripeCustomerStore;
  private readonly planStore: PlanStore;
  private readonly subscriptionStore: SubscriptionStore;
  private readonly resolveUserEmail: NonNullable<
    StripeWebhookProcessorDeps["resolveUserEmail"]
  >;
  private readonly log: NonNullable<StripeWebhookProcessorDeps["log"]>;

  constructor(options: {
    secret: string;
    toleranceSeconds?: number;
    notificationFrom?: string | null;
    deps?: StripeWebhookProcessorDeps;
  }) {
    this.secret = options.secret;
    this.toleranceSeconds = options.toleranceSeconds ?? 300;
    this.notificationFrom = options.notificationFrom ?? null;
    this.emailNotifier = options.deps?.emailNotifier;
    this.stripeEventStore = options.deps?.stripeEventStore ?? stripeEventRepo;
    this.stripeCustomerStore =
      options.deps?.stripeCustomerStore ?? stripeCustomerRepo;
    this.planStore = options.deps?.planStore ?? planRepo;
    this.subscriptionStore =
      options.deps?.subscriptionStore ?? subscriptionRepo;
    this.resolveUserEmail =
      options.deps?.resolveUserEmail ?? defaultResolveUserEmail;
    this.log = options.deps?.log ?? noopLog;
  }

  async process(input: {
    rawBody: string;
    signatureHeader: string | undefined | null;
  }): Promise<StripeWebhookOutcome> {
    let envelope: StripeEventEnvelope;
    try {
      envelope = await constructStripeEvent({
        payload: input.rawBody,
        header: input.signatureHeader,
        secret: this.secret,
        toleranceSeconds: this.toleranceSeconds,
      });
    } catch (error) {
      if (error instanceof StripeSignatureError) {
        this.log("warn", "stripe.webhook.signature_failed", {
          code: error.code,
        });
        return {
          status: "rejected",
          httpStatus: 400,
          reason: `signature: ${error.code}`,
        };
      }
      throw error;
    }

    const eventId =
      typeof envelope.id === "string" && envelope.id.trim() !== ""
        ? envelope.id
        : null;
    const type =
      typeof envelope.type === "string" && envelope.type.trim() !== ""
        ? envelope.type
        : null;

    if (!eventId || !type) {
      this.log("warn", "stripe.webhook.missing_envelope_fields", {
        has_id: eventId !== null,
        has_type: type !== null,
      });
      return {
        status: "rejected",
        httpStatus: 400,
        reason: "missing_envelope_fields",
      };
    }

    if (!isSupportedStripeEventType(type)) {
      const { created } = await this.stripeEventStore.markProcessed(
        eventId,
        type,
      );
      this.log("info", "stripe.webhook.ignored_unsupported_type", {
        event_id: eventId,
        event_type: type,
        idempotency_created: created,
      });
      return { status: "ignored", eventId, type };
    }

    const { created } = await this.stripeEventStore.markProcessed(
      eventId,
      type,
    );
    if (!created) {
      this.log("info", "stripe.webhook.duplicate", {
        event_id: eventId,
        event_type: type,
      });
      return { status: "duplicate", eventId, type };
    }

    try {
      const dataObject = envelope.data?.object;
      const details = await this.handleEvent(eventId, type, dataObject);
      this.log("info", "stripe.webhook.processed", {
        event_id: eventId,
        event_type: type,
        details,
      });
      return { status: "processed", eventId, type, details };
    } catch (error) {
      if (error instanceof StripeEventParseError) {
        this.log("warn", "stripe.webhook.parse_failed", {
          event_id: eventId,
          event_type: type,
          code: error.code,
          message: error.message,
        });
        return {
          status: "skipped",
          eventId,
          type,
          reason: `parse:${error.code}`,
        };
      }
      await this.stripeEventStore.deleteProcessed?.(eventId);
      this.log("error", "stripe.webhook.handler_failed", {
        event_id: eventId,
        event_type: type,
        message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private async handleEvent(
    eventId: string,
    type: StripeWebhookEventType,
    object: unknown,
  ): Promise<Record<string, unknown>> {
    switch (type) {
      case "checkout.session.completed":
        return await this.handleCheckoutSession(
          parseStripeCheckoutSession(object),
        );
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        return await this.handleSubscriptionLifecycle(
          type,
          parseStripeSubscriptionObject(object),
        );
      case "invoice.paid":
        return await this.handleInvoicePaid(parseStripeInvoiceObject(object));
      case "invoice.payment_failed":
        return await this.handleInvoicePaymentFailed(
          eventId,
          parseStripeInvoiceObject(object),
        );
    }
  }

  private async handleCheckoutSession(
    session: ParsedStripeCheckoutSession,
  ): Promise<Record<string, unknown>> {
    if (session.mode !== "subscription") {
      return { skipped: true, reason: `mode:${session.mode || "unknown"}` };
    }

    const userId =
      session.clientReferenceId ?? session.metadata.user_id ?? null;
    if (!userId || !session.stripeCustomerId) {
      return {
        skipped: true,
        reason: "missing_user_or_customer",
      };
    }

    await this.stripeCustomerStore.ensureForUser(
      userId,
      session.stripeCustomerId,
    );

    return {
      session_id: session.sessionId,
      stripe_customer_id: session.stripeCustomerId,
      stripe_subscription_id: session.stripeSubscriptionId,
      user_id: userId,
    };
  }

  private async handleSubscriptionLifecycle(
    type:
      | "customer.subscription.created"
      | "customer.subscription.updated"
      | "customer.subscription.deleted",
    parsed: ParsedStripeSubscription,
  ): Promise<Record<string, unknown>> {
    const metadataUserId =
      typeof parsed.metadata.user_id === "string" &&
      parsed.metadata.user_id.trim() !== ""
        ? parsed.metadata.user_id
        : null;
    const userId =
      (await this.resolveUserIdForCustomer(parsed.stripeCustomerId)) ??
      metadataUserId;
    if (!userId) {
      return {
        skipped: true,
        reason: "unknown_stripe_customer",
        stripe_customer_id: parsed.stripeCustomerId,
      };
    }
    if (metadataUserId) {
      await this.stripeCustomerStore.ensureForUser(
        metadataUserId,
        parsed.stripeCustomerId,
      );
    }

    const status: SubscriptionStatus =
      type === "customer.subscription.deleted"
        ? "canceled"
        : (parsed.status ?? "incomplete");

    const planId = await this.resolvePlanId(parsed.stripePriceIds);
    if (!planId) {
      return {
        skipped: true,
        reason: "no_plan_for_price",
        stripe_price_ids: parsed.stripePriceIds,
      };
    }

    const existing = await this.subscriptionStore.findByStripeSubscriptionId(
      parsed.stripeSubscriptionId,
    );

    const baseFields = {
      planId,
      status,
      currentPeriodStart: parsed.currentPeriodStart,
      currentPeriodEnd: parsed.currentPeriodEnd,
      cancelAtPeriodEnd: parsed.cancelAtPeriodEnd,
      stripeSubscriptionId: parsed.stripeSubscriptionId,
    };

    if (existing) {
      await this.subscriptionStore.update(existing.id, baseFields);
    } else {
      await this.subscriptionStore.upsertByUserId(userId, baseFields);
    }

    return {
      type,
      user_id: userId,
      stripe_subscription_id: parsed.stripeSubscriptionId,
      stripe_customer_id: parsed.stripeCustomerId,
      status,
      plan_id: planId,
    };
  }

  private async handleInvoicePaid(
    invoice: ParsedStripeInvoice,
  ): Promise<Record<string, unknown>> {
    if (!invoice.stripeSubscriptionId) {
      return { skipped: true, reason: "non_subscription_invoice" };
    }

    const existing = await this.subscriptionStore.findByStripeSubscriptionId(
      invoice.stripeSubscriptionId,
    );
    if (!existing) {
      return {
        skipped: true,
        reason: "no_local_subscription",
        stripe_subscription_id: invoice.stripeSubscriptionId,
      };
    }

    if (existing.status !== "active") {
      await this.subscriptionStore.update(existing.id, { status: "active" });
    }

    return {
      invoice_id: invoice.invoiceId,
      stripe_subscription_id: invoice.stripeSubscriptionId,
      previous_status: existing.status,
      next_status: "active",
    };
  }

  private async handleInvoicePaymentFailed(
    eventId: string,
    invoice: ParsedStripeInvoice,
  ): Promise<Record<string, unknown>> {
    let userId: string | null = null;
    let subscriptionUpdated = false;

    if (invoice.stripeSubscriptionId) {
      const existing = await this.subscriptionStore.findByStripeSubscriptionId(
        invoice.stripeSubscriptionId,
      );
      if (existing) {
        userId = existing.userId;
        if (existing.status !== "past_due") {
          await this.subscriptionStore.update(existing.id, {
            status: "past_due",
          });
        }
        subscriptionUpdated = true;
      }
    }

    if (!userId) {
      userId = await this.resolveUserIdForCustomer(invoice.stripeCustomerId);
    }

    let notification: "sent" | "skipped" = "skipped";
    let notificationReason: string | null = null;

    if (!userId) {
      notificationReason = "unknown_user";
    } else if (!this.notificationFrom) {
      notificationReason = "notification_from_unset";
    } else if (!this.emailNotifier) {
      notificationReason = "notifier_unset";
    } else {
      const email = await this.resolveUserEmail(userId);
      if (!email) {
        notificationReason = "no_email_for_user";
      } else {
        try {
          await this.emailNotifier({ to: email, userId, invoice });
          notification = "sent";
        } catch (error) {
          notificationReason =
            error instanceof Error
              ? `notifier_error:${error.message}`
              : "notifier_error";
          this.log("error", "stripe.webhook.notification_failed", {
            event_id: eventId,
            user_id: userId,
            message: notificationReason,
          });
        }
      }
    }

    return {
      invoice_id: invoice.invoiceId,
      stripe_customer_id: invoice.stripeCustomerId,
      stripe_subscription_id: invoice.stripeSubscriptionId,
      user_id: userId,
      subscription_updated: subscriptionUpdated,
      notification,
      notification_reason: notificationReason,
    };
  }

  private async resolveUserIdForCustomer(
    stripeCustomerId: string,
  ): Promise<string | null> {
    const row =
      await this.stripeCustomerStore.findByStripeCustomerId(stripeCustomerId);
    return row?.userId ?? null;
  }

  private async resolvePlanId(
    stripePriceIds: readonly string[],
  ): Promise<string | null> {
    if (stripePriceIds.length > 0) {
      const planPrices = new Set(stripePriceIds);
      const plans = await this.planStore.list();
      const matched = plans.find(
        (plan) =>
          plan.stripePriceId !== null && planPrices.has(plan.stripePriceId),
      );
      if (matched) return matched.id;
      return null;
    }
    const free = await this.planStore.ensureFreePlan();
    return free?.id ?? null;
  }
}

export function buildPaymentFailedEmail(input: {
  invoice: ParsedStripeInvoice;
}): { subject: string; text: string; html: string } {
  const subject = "Payment failed — update card";
  const dollars = (input.invoice.amountDueCents / 100).toFixed(2);
  const link = input.invoice.hostedInvoiceUrl;
  const text = [
    "Your most recent payment failed.",
    `Amount due: $${dollars}.`,
    link ? `Update your card or retry payment: ${link}` : "",
    "Your account is now flagged as past due. Email won't be cut off immediately, but service will be paused if it stays past due.",
  ]
    .filter(Boolean)
    .join("\n");
  const escapedLink = link ? escapeHtml(link) : null;
  const html = [
    "<p>Your most recent payment failed.</p>",
    `<p><strong>Amount due:</strong> $${dollars}</p>`,
    escapedLink
      ? `<p><a href="${escapedLink}">Update your card or retry payment</a></p>`
      : "",
    "<p>Your account is now flagged as past due. Email won't be cut off immediately, but service will be paused if it stays past due.</p>",
  ]
    .filter(Boolean)
    .join("\n");
  return { subject, text, html };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
