CREATE TABLE IF NOT EXISTS "contact_properties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"type" varchar(50) DEFAULT 'string' NOT NULL,
	"fallback_value" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"document" jsonb,
	"user_id" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "email_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email_id" uuid NOT NULL REFERENCES "public"."emails"("id"),
	"source_id" varchar(255),
	"type" varchar(50) NOT NULL,
	"payload" jsonb NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "received_emails" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from" varchar(512) NOT NULL,
	"to" jsonb NOT NULL,
	"subject" text NOT NULL,
	"html" text,
	"text" text,
	"status" varchar(50) DEFAULT 'received' NOT NULL,
	"attachments" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "webhook_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"webhook_id" uuid NOT NULL REFERENCES "public"."webhooks"("id") ON DELETE cascade,
	"event_id" uuid NOT NULL REFERENCES "public"."email_events"("id"),
	"attempt" integer DEFAULT 1 NOT NULL,
	"status_code" integer,
	"response_body" text,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"attempted_at" timestamp with time zone,
	"next_retry_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "broadcasts" ADD COLUMN IF NOT EXISTS "text" text;
--> statement-breakpoint
ALTER TABLE "domains" ADD COLUMN IF NOT EXISTS "custom_return_path" varchar(255);
--> statement-breakpoint
ALTER TABLE "domains" ADD COLUMN IF NOT EXISTS "tracking_subdomain" varchar(255);
--> statement-breakpoint
ALTER TABLE "domains" ADD COLUMN IF NOT EXISTS "capabilities" jsonb;
--> statement-breakpoint
ALTER TABLE "emails" ADD COLUMN IF NOT EXISTS "topic_id" uuid;
--> statement-breakpoint
ALTER TABLE "emails" ADD COLUMN IF NOT EXISTS "idempotency_key" varchar(255);
--> statement-breakpoint
ALTER TABLE "emails" ADD COLUMN IF NOT EXISTS "sent_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "logs" ADD COLUMN IF NOT EXISTS "api_key_id" uuid;
--> statement-breakpoint
ALTER TABLE "templates" ADD COLUMN IF NOT EXISTS "current_version_id" uuid;
--> statement-breakpoint
ALTER TABLE "templates" ADD COLUMN IF NOT EXISTS "published_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "templates" ADD COLUMN IF NOT EXISTS "has_unpublished_versions" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
ALTER TABLE "webhooks" ADD COLUMN IF NOT EXISTS "signing_secret" varchar(255);
--> statement-breakpoint
ALTER TABLE "email_events" ADD COLUMN IF NOT EXISTS "source_id" varchar(255);
--> statement-breakpoint
ALTER TABLE "session" ADD COLUMN IF NOT EXISTS "ip_address" text;
--> statement-breakpoint
ALTER TABLE "session" ADD COLUMN IF NOT EXISTS "user_agent" text;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "contact_properties_key_idx" ON "contact_properties" USING btree ("key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_events_email_id_idx" ON "email_events" USING btree ("email_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "email_events_source_id_idx" ON "email_events" USING btree ("source_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "received_emails_created_at_idx" ON "received_emails" USING btree ("created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "webhook_deliveries_webhook_id_idx" ON "webhook_deliveries" USING btree ("webhook_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "webhook_deliveries_status_idx" ON "webhook_deliveries" USING btree ("status");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "emails_idempotency_key_idx" ON "emails" USING btree ("idempotency_key");
