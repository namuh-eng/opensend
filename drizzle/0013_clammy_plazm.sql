ALTER TABLE "email_events" ALTER COLUMN "email_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "email_events" ADD COLUMN "user_id" text;--> statement-breakpoint
CREATE INDEX "email_events_user_id_idx" ON "email_events" USING btree ("user_id");