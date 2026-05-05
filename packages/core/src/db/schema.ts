import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

// ── Better Auth Tables ──────────────────────────────────────────────

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});

// ── Application Tables ──────────────────────────────────────────────

export const domains = pgTable("domains", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  status: varchar("status", { length: 50 }).notNull().default("not_started"),
  region: varchar("region", { length: 50 }).notNull().default("us-east-1"),
  dkimTokens: jsonb("dkim_tokens").$type<string[]>(),
  records:
    jsonb("records").$type<
      Array<{
        type: string;
        name: string;
        value: string;
        status: string;
        ttl: string;
        priority?: number;
      }>
    >(),
  trackClicks: boolean("track_clicks").notNull().default(false),
  trackOpens: boolean("track_opens").notNull().default(false),
  tls: varchar("tls", { length: 20 }).notNull().default("opportunistic"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  document: jsonb("document"),
  userId: text("user_id"),
  customReturnPath: varchar("custom_return_path", { length: 255 }),
  trackingSubdomain: varchar("tracking_subdomain", { length: 255 }),
  capabilities:
    jsonb("capabilities").$type<Array<{ name: string; enabled: boolean }>>(),
});

export const apiKeys = pgTable(
  "api_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 255 }).notNull(),
    tokenHash: text("token_hash").notNull(),
    tokenPreview: varchar("token_preview", { length: 50 }),
    permission: varchar("permission", { length: 50 })
      .notNull()
      .default("full_access"),
    domain: varchar("domain", { length: 255 }),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    document: jsonb("document"),
    userId: text("user_id"),
  },
  (table) => [uniqueIndex("api_keys_token_hash_idx").on(table.tokenHash)],
);

export const emails = pgTable(
  "emails",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    from: varchar("from", { length: 512 }).notNull(),
    to: jsonb("to").notNull().$type<string[]>(),
    cc: jsonb("cc").$type<string[]>(),
    bcc: jsonb("bcc").$type<string[]>(),
    replyTo: jsonb("reply_to").$type<string[]>(),
    subject: text("subject").notNull(),
    html: text("html"),
    text: text("text"),
    status: varchar("status", { length: 50 }).notNull().default("queued"),
    tags: jsonb("tags").$type<Array<{ name: string; value: string }>>(),
    headers: jsonb("headers").$type<Record<string, string>>(),
    attachments:
      jsonb("attachments").$type<
        Array<{
          filename: string;
          content?: string;
          path?: string;
          content_type?: string;
          content_id?: string;
        }>
      >(),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    document: jsonb("document"),
    userId: text("user_id"),
    topicId: uuid("topic_id"),
    idempotencyKey: varchar("idempotency_key", { length: 255 }),
  },
  (table) => [
    index("emails_status_idx").on(table.status),
    index("emails_created_at_idx").on(table.createdAt),
    index("emails_status_created_at_idx").on(table.status, table.createdAt),
    uniqueIndex("emails_idempotency_key_idx").on(table.idempotencyKey),
  ],
);

export const segments = pgTable("segments", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  contactsCount: integer("contacts_count").notNull().default(0),
  unsubscribedCount: integer("unsubscribed_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  document: jsonb("document"),
  userId: text("user_id"),
});

export const topics = pgTable("topics", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  description: varchar("description", { length: 1024 }),
  defaultSubscription: varchar("default_subscription", { length: 50 })
    .notNull()
    .default("opt_out"),
  visibility: varchar("visibility", { length: 50 }).notNull().default("public"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  document: jsonb("document"),
  userId: text("user_id"),
});

export type SuppressionReason = "bounced" | "complained";

export type SuppressionSourceMetadata = {
  source?: "ses" | "operator";
  sourceEventId?: string;
  sourceEmailId?: string;
  sourceMessageId?: string;
  bounceType?: string;
  complaintFeedbackType?: string;
};

export const emailSuppressions = pgTable(
  "email_suppressions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    email: varchar("email", { length: 512 }).notNull(),
    reason: varchar("reason", { length: 50 })
      .$type<SuppressionReason>()
      .notNull(),
    sourceEventId: varchar("source_event_id", { length: 255 }),
    sourceEmailId: uuid("source_email_id"),
    sourceMessageId: varchar("source_message_id", { length: 255 }),
    metadata: jsonb("metadata").$type<SuppressionSourceMetadata>(),
    suppressedAt: timestamp("suppressed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("email_suppressions_user_email_idx").on(
      table.userId,
      table.email,
    ),
    index("email_suppressions_user_idx").on(table.userId),
    index("email_suppressions_email_idx").on(table.email),
  ],
);

export const contacts = pgTable(
  "contacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: varchar("email", { length: 512 }).notNull(),
    firstName: varchar("first_name", { length: 255 }),
    lastName: varchar("last_name", { length: 255 }),
    unsubscribed: boolean("unsubscribed").notNull().default(false),
    customProperties:
      jsonb("custom_properties").$type<Record<string, string>>(),
    segments: jsonb("segments").$type<string[]>(),
    topicSubscriptions: jsonb("topic_subscriptions").$type<
      Array<{ topicId: string; subscribed: boolean }>
    >(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    document: jsonb("document"),
    userId: text("user_id"),
  },
  (table) => [
    uniqueIndex("contacts_email_idx").on(table.email),
    index("contacts_unsubscribed_idx").on(table.unsubscribed),
    index("contacts_created_at_idx").on(table.createdAt),
  ],
);

export const broadcasts = pgTable("broadcasts", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull().default("Untitled"),
  status: varchar("status", { length: 50 }).notNull().default("draft"),
  from: varchar("from", { length: 512 }),
  subject: text("subject"),
  html: text("html"),
  replyTo: varchar("reply_to", { length: 512 }),
  previewText: text("preview_text"),
  audienceId: uuid("audience_id"),
  topicId: uuid("topic_id"),
  text: text("text"),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  document: jsonb("document"),
  userId: text("user_id"),
});

export const webhooks = pgTable("webhooks", {
  id: uuid("id").primaryKey().defaultRandom(),
  url: text("url").notNull(),
  eventTypes: jsonb("event_types").notNull().$type<string[]>(),
  status: varchar("status", { length: 50 }).notNull().default("active"),
  signingSecret: varchar("signing_secret", { length: 255 }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  document: jsonb("document"),
  userId: text("user_id"),
});

export const templates = pgTable("templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull().default("Untitled Template"),
  alias: varchar("alias", { length: 255 }),
  status: varchar("status", { length: 50 }).notNull().default("draft"),
  subject: text("subject"),
  from: varchar("from", { length: 512 }),
  replyTo: varchar("reply_to", { length: 512 }),
  previewText: text("preview_text"),
  html: text("html"),
  text: text("text"),
  variables:
    jsonb("variables").$type<Array<{ name: string; required: boolean }>>(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  document: jsonb("document"),
  userId: text("user_id"),
});

export const logs = pgTable("logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  endpoint: text("endpoint"),
  status: integer("status"),
  method: varchar("method", { length: 10 }),
  userAgent: text("user_agent"),
  requestBody: jsonb("request_body"),
  responseBody: jsonb("response_body"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  document: jsonb("document"),
  userId: text("user_id"),
});

export const contactProperties = pgTable(
  "contact_properties",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    key: varchar("key", { length: 255 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    type: varchar("type", { length: 50 }).notNull().default("string"),
    fallbackValue: text("fallback_value"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    document: jsonb("document"),
    userId: text("user_id"),
  },
  (table) => [uniqueIndex("contact_properties_key_idx").on(table.key)],
);

export const receivedEmails = pgTable(
  "received_emails",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    from: varchar("from", { length: 512 }).notNull(),
    to: jsonb("to").notNull().$type<string[]>(),
    subject: text("subject").notNull(),
    html: text("html"),
    text: text("text"),
    status: varchar("status", { length: 50 }).notNull().default("received"),
    attachments:
      jsonb("attachments").$type<
        Array<{
          id: string;
          filename: string;
          contentType: string;
          size: number;
          s3Key: string;
        }>
      >(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    userId: text("user_id"),
  },
  (table) => [index("received_emails_created_at_idx").on(table.createdAt)],
);

export const emailEvents = pgTable(
  "email_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    emailId: uuid("email_id")
      .notNull()
      .references(() => emails.id),
    sourceId: varchar("source_id", { length: 255 }),
    type: varchar("type", { length: 50 }).notNull(),
    payload: jsonb("payload").notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("email_events_email_id_idx").on(t.emailId),
    uniqueIndex("email_events_source_id_idx").on(t.sourceId),
  ],
);

export const webhookDeliveries = pgTable(
  "webhook_deliveries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    webhookId: uuid("webhook_id")
      .notNull()
      .references(() => webhooks.id, { onDelete: "cascade" }),
    eventId: uuid("event_id")
      .notNull()
      .references(() => emailEvents.id),
    attempt: integer("attempt").notNull().default(1),
    statusCode: integer("status_code"),
    responseBody: text("response_body"),
    status: varchar("status", { length: 50 }).notNull().default("pending"), // pending, success, failed, dead_letter
    attemptedAt: timestamp("attempted_at", { withTimezone: true }),
    nextRetryAt: timestamp("next_retry_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("webhook_deliveries_webhook_id_idx").on(t.webhookId),
    index("webhook_deliveries_status_idx").on(t.status),
  ],
);

// ── Automations ─────────────────────────────────────────────────────

export type AutomationConnection = {
  from: string;
  to: string;
  type?: "default" | "condition_met" | "condition_not_met";
};

export type AutomationStepStateEntry = {
  status:
    | "pending"
    | "running"
    | "waiting"
    | "completed"
    | "failed"
    | "skipped";
  startedAt?: string;
  completedAt?: string;
  scheduledFor?: string;
  error?: string;
  output?: Record<string, unknown>;
};

export const automations = pgTable(
  "automations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 255 }).notNull().default("Untitled"),
    status: varchar("status", { length: 50 }).notNull().default("draft"),
    triggerEventName: varchar("trigger_event_name", { length: 255 }),
    connections: jsonb("connections").$type<AutomationConnection[]>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    document: jsonb("document"),
    userId: text("user_id"),
  },
  (t) => [
    index("automations_status_trigger_idx").on(t.status, t.triggerEventName),
    index("automations_user_id_idx").on(t.userId),
  ],
);

export const automationSteps = pgTable(
  "automation_steps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    automationId: uuid("automation_id")
      .notNull()
      .references(() => automations.id, { onDelete: "cascade" }),
    key: varchar("key", { length: 64 }).notNull(),
    type: varchar("type", { length: 50 }).notNull(),
    config: jsonb("config").notNull().$type<Record<string, unknown>>(),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("automation_steps_automation_id_key_idx").on(
      t.automationId,
      t.key,
    ),
    index("automation_steps_automation_id_position_idx").on(
      t.automationId,
      t.position,
    ),
  ],
);

export const customEvents = pgTable(
  "custom_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 255 }).notNull(),
    schema: jsonb("schema"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    userId: text("user_id"),
  },
  (t) => [uniqueIndex("custom_events_user_name_idx").on(t.userId, t.name)],
);

export const customEventDeliveries = pgTable(
  "custom_event_deliveries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventName: varchar("event_name", { length: 255 }).notNull(),
    contactId: uuid("contact_id"),
    email: varchar("email", { length: 512 }),
    payload: jsonb("payload").notNull().$type<Record<string, unknown>>(),
    receivedAt: timestamp("received_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    userId: text("user_id"),
  },
  (t) => [
    index("custom_event_deliveries_event_name_idx").on(t.eventName),
    index("custom_event_deliveries_received_at_idx").on(t.receivedAt),
  ],
);

export const automationRuns = pgTable(
  "automation_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    automationId: uuid("automation_id")
      .notNull()
      .references(() => automations.id, { onDelete: "cascade" }),
    triggerEventId: uuid("trigger_event_id"),
    contactId: uuid("contact_id"),
    status: varchar("status", { length: 50 }).notNull().default("queued"),
    currentStepKey: varchar("current_step_key", { length: 64 }),
    stepStates:
      jsonb("step_states").$type<Record<string, AutomationStepStateEntry>>(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    nextStepAt: timestamp("next_step_at", { withTimezone: true }),
    failureReason: text("failure_reason"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    userId: text("user_id"),
  },
  (t) => [
    index("automation_runs_status_next_step_at_idx").on(t.status, t.nextStepAt),
    index("automation_runs_automation_id_created_at_idx").on(
      t.automationId,
      t.createdAt,
    ),
  ],
);

// ── Billing Tables (additive, gated by BILLING_BACKEND) ────────────

export const plans = pgTable(
  "plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: varchar("slug", { length: 64 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    monthlyPriceCents: integer("monthly_price_cents").notNull().default(0),
    monthlyEmailQuota: integer("monthly_email_quota").notNull().default(0),
    maxDomains: integer("max_domains").notNull().default(0),
    maxApiKeys: integer("max_api_keys").notNull().default(0),
    stripePriceId: varchar("stripe_price_id", { length: 255 }),
    isPublic: boolean("is_public").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("plans_slug_idx").on(t.slug)],
);

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    planId: uuid("plan_id")
      .notNull()
      .references(() => plans.id),
    status: varchar("status", { length: 50 }).notNull().default("active"),
    currentPeriodStart: timestamp("current_period_start", {
      withTimezone: true,
    }),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    stripeSubscriptionId: varchar("stripe_subscription_id", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("subscriptions_user_id_idx").on(t.userId),
    uniqueIndex("subscriptions_stripe_subscription_id_idx").on(
      t.stripeSubscriptionId,
    ),
    index("subscriptions_status_idx").on(t.status),
  ],
);

export const stripeCustomers = pgTable(
  "stripe_customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    stripeCustomerId: varchar("stripe_customer_id", { length: 255 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("stripe_customers_user_id_idx").on(t.userId),
    uniqueIndex("stripe_customers_stripe_customer_id_idx").on(
      t.stripeCustomerId,
    ),
  ],
);

export const usagePeriods = pgTable(
  "usage_periods",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
    periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
    emailsSent: integer("emails_sent").notNull().default(0),
    lastIncrementAt: timestamp("last_increment_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("usage_periods_user_period_idx").on(t.userId, t.periodStart),
    index("usage_periods_user_id_idx").on(t.userId),
  ],
);

export const stripeEventsProcessed = pgTable(
  "stripe_events_processed",
  {
    eventId: varchar("event_id", { length: 255 }).primaryKey(),
    type: varchar("type", { length: 255 }).notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("stripe_events_processed_processed_at_idx").on(t.processedAt)],
);
