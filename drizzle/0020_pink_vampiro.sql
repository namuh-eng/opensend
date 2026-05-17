ALTER TABLE "plans" ADD COLUMN "daily_email_quota" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN "max_contacts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN "max_segments" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN "max_broadcasts" integer;--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN "rate_per_second" integer DEFAULT 2 NOT NULL;