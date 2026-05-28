ALTER TABLE "emails" ADD COLUMN IF NOT EXISTS "thread_id" uuid;--> statement-breakpoint
ALTER TABLE "emails" ADD COLUMN IF NOT EXISTS "reply_address" varchar(512);--> statement-breakpoint
ALTER TABLE "emails" ADD COLUMN IF NOT EXISTS "reply_token" varchar(128);--> statement-breakpoint
ALTER TABLE "received_emails" ADD COLUMN IF NOT EXISTS "headers" jsonb;--> statement-breakpoint
ALTER TABLE "received_emails" ADD COLUMN IF NOT EXISTS "reply_match_status" varchar(32) DEFAULT 'unmatched' NOT NULL;--> statement-breakpoint
ALTER TABLE "received_emails" ADD COLUMN IF NOT EXISTS "thread_id" uuid;--> statement-breakpoint
ALTER TABLE "received_emails" ADD COLUMN IF NOT EXISTS "reply_to_email_id" uuid;--> statement-breakpoint
ALTER TABLE "received_emails" ADD COLUMN IF NOT EXISTS "contact_id" uuid;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "received_emails" ADD CONSTRAINT "received_emails_reply_to_email_id_emails_id_fk" FOREIGN KEY ("reply_to_email_id") REFERENCES "public"."emails"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "received_emails" ADD CONSTRAINT "received_emails_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "emails_user_thread_idx" ON "emails" USING btree ("user_id","thread_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "emails_user_id_reply_token_idx" ON "emails" USING btree ("user_id","reply_token");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "received_emails_user_thread_idx" ON "received_emails" USING btree ("user_id","thread_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "received_emails_reply_to_email_idx" ON "received_emails" USING btree ("reply_to_email_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "received_emails_contact_id_idx" ON "received_emails" USING btree ("contact_id");
