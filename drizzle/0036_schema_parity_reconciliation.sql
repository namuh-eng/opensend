-- Full schema reconciliation: make migration-provisioned databases match schema.ts.
--
-- Follow-up to 0035 (api_keys). The snapshot/SQL drift introduced at snapshot
-- 0001 covered far more than api_keys: databases provisioned by replaying
-- drizzle/*.sql (production migrator, docker-compose self-hosting) are missing
-- columns (contacts.document, broadcasts.audience_id, domains.dkim_tokens, ...),
-- carry legacy enum types where schema.ts uses varchar, keep legacy junction
-- tables (contact_segments, contact_topics, properties), and lack several
-- indexes. Databases provisioned via db:push match schema.ts and are no-ops here.
--
-- Every statement is guarded/idempotent. Where a legacy column has an obvious
-- successor (contacts.properties -> custom_properties, webhooks.endpoint -> url,
-- webhooks.events -> event_types) data is backfilled before the legacy column
-- is dropped.
--
-- Also declares inbound_provider_events_primary_event_idx (the partial unique
-- dedupe guard previously created only by hand-written migration SQL) in
-- schema.ts, and creates it here for push-provisioned databases that lack it.

ALTER TABLE "broadcasts" DROP CONSTRAINT IF EXISTS "broadcasts_segment_id_segments_id_fk";--> statement-breakpoint
ALTER TABLE "broadcasts" DROP CONSTRAINT IF EXISTS "broadcasts_topic_id_topics_id_fk";--> statement-breakpoint
ALTER TABLE "emails" DROP CONSTRAINT IF EXISTS "emails_api_key_id_api_keys_id_fk";--> statement-breakpoint
ALTER TABLE "emails" DROP CONSTRAINT IF EXISTS "emails_domain_id_domains_id_fk";--> statement-breakpoint
ALTER TABLE "logs" DROP CONSTRAINT IF EXISTS "logs_api_key_id_api_keys_id_fk";--> statement-breakpoint
DROP TABLE IF EXISTS "contact_segments" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "contact_topics" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "properties" CASCADE;--> statement-breakpoint
ALTER TABLE "broadcasts" ADD COLUMN IF NOT EXISTS "audience_id" uuid;--> statement-breakpoint
ALTER TABLE "broadcasts" ADD COLUMN IF NOT EXISTS "document" jsonb;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "custom_properties" jsonb;--> statement-breakpoint
DO $$ BEGIN
  UPDATE "contacts" SET "custom_properties" = "properties" WHERE "custom_properties" IS NULL AND "properties" IS NOT NULL;
EXCEPTION WHEN undefined_column THEN NULL; END $$;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "document" jsonb;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "segments" jsonb;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "topic_subscriptions" jsonb;--> statement-breakpoint
ALTER TABLE "domains" ADD COLUMN IF NOT EXISTS "dkim_tokens" jsonb;--> statement-breakpoint
ALTER TABLE "domains" ADD COLUMN IF NOT EXISTS "document" jsonb;--> statement-breakpoint
ALTER TABLE "domains" ADD COLUMN IF NOT EXISTS "track_clicks" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "domains" ADD COLUMN IF NOT EXISTS "track_opens" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "emails" ADD COLUMN IF NOT EXISTS "attachments" jsonb;--> statement-breakpoint
ALTER TABLE "emails" ADD COLUMN IF NOT EXISTS "document" jsonb;--> statement-breakpoint
ALTER TABLE "emails" ADD COLUMN IF NOT EXISTS "headers" jsonb;--> statement-breakpoint
ALTER TABLE "emails" ADD COLUMN IF NOT EXISTS "status" character varying(50) DEFAULT 'queued'::character varying NOT NULL;--> statement-breakpoint
ALTER TABLE "logs" ADD COLUMN IF NOT EXISTS "endpoint" text;--> statement-breakpoint
ALTER TABLE "logs" ADD COLUMN IF NOT EXISTS "status" integer;--> statement-breakpoint
ALTER TABLE "logs" ADD COLUMN IF NOT EXISTS "user_agent" text;--> statement-breakpoint
ALTER TABLE "segments" ADD COLUMN IF NOT EXISTS "contacts_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "segments" ADD COLUMN IF NOT EXISTS "document" jsonb;--> statement-breakpoint
ALTER TABLE "segments" ADD COLUMN IF NOT EXISTS "unsubscribed_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "templates" ADD COLUMN IF NOT EXISTS "document" jsonb;--> statement-breakpoint
ALTER TABLE "templates" ADD COLUMN IF NOT EXISTS "status" character varying(50) DEFAULT 'draft'::character varying NOT NULL;--> statement-breakpoint
ALTER TABLE "topics" ADD COLUMN IF NOT EXISTS "document" jsonb;--> statement-breakpoint
ALTER TABLE "webhooks" ADD COLUMN IF NOT EXISTS "document" jsonb;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "webhooks" ADD COLUMN IF NOT EXISTS "event_types" jsonb;
  UPDATE "webhooks" SET "event_types" = COALESCE("event_types", to_jsonb("events")) WHERE "event_types" IS NULL;
  UPDATE "webhooks" SET "event_types" = '[]'::jsonb WHERE "event_types" IS NULL;
  ALTER TABLE "webhooks" ALTER COLUMN "event_types" SET NOT NULL;
EXCEPTION WHEN undefined_column THEN
  UPDATE "webhooks" SET "event_types" = '[]'::jsonb WHERE "event_types" IS NULL;
  ALTER TABLE "webhooks" ALTER COLUMN "event_types" SET NOT NULL;
END $$;--> statement-breakpoint
ALTER TABLE "webhooks" ADD COLUMN IF NOT EXISTS "status" character varying(50) DEFAULT 'active'::character varying NOT NULL;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "webhooks" ADD COLUMN IF NOT EXISTS "url" text;
  UPDATE "webhooks" SET "url" = COALESCE("url", "endpoint") WHERE "url" IS NULL;
  UPDATE "webhooks" SET "url" = '' WHERE "url" IS NULL;
  ALTER TABLE "webhooks" ALTER COLUMN "url" SET NOT NULL;
EXCEPTION WHEN undefined_column THEN
  UPDATE "webhooks" SET "url" = '' WHERE "url" IS NULL;
  ALTER TABLE "webhooks" ALTER COLUMN "url" SET NOT NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "broadcasts" ALTER COLUMN "preview_text" DROP DEFAULT;
  ALTER TABLE "broadcasts" ALTER COLUMN "preview_text" TYPE text USING "preview_text"::text::text;
EXCEPTION WHEN others THEN RAISE; END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "broadcasts" ALTER COLUMN "status" DROP DEFAULT;
  ALTER TABLE "broadcasts" ALTER COLUMN "status" TYPE character varying(50) USING "status"::text::character varying(50);
EXCEPTION WHEN others THEN RAISE; END $$;--> statement-breakpoint
ALTER TABLE "broadcasts" ALTER COLUMN "status" SET DEFAULT 'draft'::character varying;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "broadcasts" ALTER COLUMN "subject" DROP DEFAULT;
  ALTER TABLE "broadcasts" ALTER COLUMN "subject" TYPE text USING "subject"::text::text;
EXCEPTION WHEN others THEN RAISE; END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "domains" ALTER COLUMN "status" DROP DEFAULT;
  ALTER TABLE "domains" ALTER COLUMN "status" TYPE character varying(50) USING "status"::text::character varying(50);
EXCEPTION WHEN others THEN RAISE; END $$;--> statement-breakpoint
ALTER TABLE "domains" ALTER COLUMN "status" SET DEFAULT 'not_started'::character varying;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "domains" ALTER COLUMN "tls" DROP DEFAULT;
  ALTER TABLE "domains" ALTER COLUMN "tls" TYPE character varying(20) USING "tls"::text::character varying(20);
EXCEPTION WHEN others THEN RAISE; END $$;--> statement-breakpoint
ALTER TABLE "domains" ALTER COLUMN "tls" SET DEFAULT 'opportunistic'::character varying;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "emails" ALTER COLUMN "reply_to" DROP DEFAULT;
  ALTER TABLE "emails" ALTER COLUMN "reply_to" TYPE jsonb USING "reply_to"::text::jsonb;
EXCEPTION WHEN others THEN RAISE; END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "emails" ALTER COLUMN "subject" DROP DEFAULT;
  ALTER TABLE "emails" ALTER COLUMN "subject" TYPE text USING "subject"::text::text;
EXCEPTION WHEN others THEN RAISE; END $$;--> statement-breakpoint
ALTER TABLE "logs" ALTER COLUMN "method" DROP NOT NULL;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "templates" ALTER COLUMN "preview_text" DROP DEFAULT;
  ALTER TABLE "templates" ALTER COLUMN "preview_text" TYPE text USING "preview_text"::text::text;
EXCEPTION WHEN others THEN RAISE; END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "templates" ALTER COLUMN "subject" DROP DEFAULT;
  ALTER TABLE "templates" ALTER COLUMN "subject" TYPE text USING "subject"::text::text;
EXCEPTION WHEN others THEN RAISE; END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "topics" ALTER COLUMN "default_subscription" DROP DEFAULT;
  ALTER TABLE "topics" ALTER COLUMN "default_subscription" TYPE character varying(50) USING "default_subscription"::text::character varying(50);
EXCEPTION WHEN others THEN RAISE; END $$;--> statement-breakpoint
ALTER TABLE "topics" ALTER COLUMN "default_subscription" SET DEFAULT 'opt_out'::character varying;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "topics" ALTER COLUMN "description" DROP DEFAULT;
  ALTER TABLE "topics" ALTER COLUMN "description" TYPE character varying(1024) USING "description"::text::character varying(1024);
EXCEPTION WHEN others THEN RAISE; END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "topics" ALTER COLUMN "visibility" DROP DEFAULT;
  ALTER TABLE "topics" ALTER COLUMN "visibility" TYPE character varying(50) USING "visibility"::text::character varying(50);
EXCEPTION WHEN others THEN RAISE; END $$;--> statement-breakpoint
ALTER TABLE "topics" ALTER COLUMN "visibility" SET DEFAULT 'public'::character varying;--> statement-breakpoint
ALTER TABLE "broadcasts" DROP COLUMN IF EXISTS "segment_id";--> statement-breakpoint
ALTER TABLE "broadcasts" DROP COLUMN IF EXISTS "sent_at";--> statement-breakpoint
ALTER TABLE "broadcasts" DROP COLUMN IF EXISTS "updated_at";--> statement-breakpoint
ALTER TABLE "contacts" DROP COLUMN IF EXISTS "properties";--> statement-breakpoint
ALTER TABLE "contacts" DROP COLUMN IF EXISTS "updated_at";--> statement-breakpoint
ALTER TABLE "domains" DROP COLUMN IF EXISTS "click_tracking";--> statement-breakpoint
ALTER TABLE "domains" DROP COLUMN IF EXISTS "open_tracking";--> statement-breakpoint
ALTER TABLE "domains" DROP COLUMN IF EXISTS "receiving_enabled";--> statement-breakpoint
ALTER TABLE "domains" DROP COLUMN IF EXISTS "sending_enabled";--> statement-breakpoint
ALTER TABLE "domains" DROP COLUMN IF EXISTS "updated_at";--> statement-breakpoint
ALTER TABLE "email_events" DROP COLUMN IF EXISTS "data";--> statement-breakpoint
ALTER TABLE "email_events" DROP COLUMN IF EXISTS "timestamp";--> statement-breakpoint
ALTER TABLE "emails" DROP COLUMN IF EXISTS "api_key_id";--> statement-breakpoint
ALTER TABLE "emails" DROP COLUMN IF EXISTS "domain_id";--> statement-breakpoint
ALTER TABLE "emails" DROP COLUMN IF EXISTS "last_event";--> statement-breakpoint
ALTER TABLE "emails" DROP COLUMN IF EXISTS "ses_message_id";--> statement-breakpoint
ALTER TABLE "logs" DROP COLUMN IF EXISTS "duration";--> statement-breakpoint
ALTER TABLE "logs" DROP COLUMN IF EXISTS "path";--> statement-breakpoint
ALTER TABLE "logs" DROP COLUMN IF EXISTS "status_code";--> statement-breakpoint
ALTER TABLE "templates" DROP COLUMN IF EXISTS "published";--> statement-breakpoint
ALTER TABLE "templates" DROP COLUMN IF EXISTS "updated_at";--> statement-breakpoint
ALTER TABLE "webhooks" DROP COLUMN IF EXISTS "active";--> statement-breakpoint
ALTER TABLE "webhooks" DROP COLUMN IF EXISTS "endpoint";--> statement-breakpoint
ALTER TABLE "webhooks" DROP COLUMN IF EXISTS "events";--> statement-breakpoint
DROP TYPE IF EXISTS "broadcast_status";--> statement-breakpoint
DROP TYPE IF EXISTS "domain_status";--> statement-breakpoint
DROP TYPE IF EXISTS "email_status";--> statement-breakpoint
DROP TYPE IF EXISTS "permission_type";--> statement-breakpoint
DROP TYPE IF EXISTS "topic_default_subscription";--> statement-breakpoint
DROP TYPE IF EXISTS "topic_visibility";--> statement-breakpoint
DROP TYPE IF EXISTS "webhook_event";--> statement-breakpoint
-- Same-name FK exists with ON DELETE CASCADE on migration-provisioned databases;
-- schema.ts declares it without a delete action. Recreate to match schema.ts.
ALTER TABLE "email_events" DROP CONSTRAINT IF EXISTS "email_events_email_id_emails_id_fk";--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "email_events" ADD CONSTRAINT "email_events_email_id_emails_id_fk" FOREIGN KEY (email_id) REFERENCES public.emails(id); EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS contacts_created_at_idx ON public.contacts USING btree (created_at);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS contacts_unsubscribed_idx ON public.contacts USING btree (unsubscribed);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS emails_created_at_idx ON public.emails USING btree (created_at);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS emails_status_created_at_idx ON public.emails USING btree (status, created_at);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS emails_status_idx ON public.emails USING btree (status);--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "inbound_provider_events_primary_event_idx" ON "inbound_provider_events" USING btree ("provider","provider_event_id") WHERE status <> 'duplicate_provider_event';
