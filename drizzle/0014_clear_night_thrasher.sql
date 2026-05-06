ALTER TABLE "emails" ADD COLUMN "provider_retry_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "emails" ADD COLUMN "provider_last_attempted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "emails" ADD COLUMN "provider_next_retry_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "emails" ADD COLUMN "provider_last_error_code" varchar(255);--> statement-breakpoint
ALTER TABLE "emails" ADD COLUMN "provider_last_error_message" text;--> statement-breakpoint
ALTER TABLE "emails" ADD COLUMN "provider_dead_lettered_at" timestamp with time zone;