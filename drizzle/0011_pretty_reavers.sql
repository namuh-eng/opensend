CREATE TABLE "email_suppressions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"email" varchar(512) NOT NULL,
	"reason" varchar(50) NOT NULL,
	"source_event_id" varchar(255),
	"source_email_id" uuid,
	"source_message_id" varchar(255),
	"metadata" jsonb,
	"suppressed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "email_suppressions_user_email_idx" ON "email_suppressions" USING btree ("user_id","email");--> statement-breakpoint
CREATE INDEX "email_suppressions_user_idx" ON "email_suppressions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "email_suppressions_email_idx" ON "email_suppressions" USING btree ("email");