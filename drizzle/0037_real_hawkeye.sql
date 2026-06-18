CREATE TABLE "billing_overage_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"usage_period_id" uuid NOT NULL,
	"report_key" varchar(255) NOT NULL,
	"stripe_customer_id" varchar(255) NOT NULL,
	"stripe_subscription_id" varchar(255) NOT NULL,
	"meter_event_name" varchar(255) NOT NULL,
	"from_overage_emails" integer NOT NULL,
	"through_overage_emails" integer NOT NULL,
	"delta_emails" integer NOT NULL,
	"status" varchar(32) DEFAULT 'pending' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"stripe_submission_started_at" timestamp with time zone,
	"stripe_reported_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN "stripe_overage_price_id" varchar(255);--> statement-breakpoint
ALTER TABLE "usage_periods" ADD COLUMN "included_email_quota" integer;--> statement-breakpoint
ALTER TABLE "usage_periods" ADD COLUMN "overage_reported_emails" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "usage_periods" ADD COLUMN "overage_claimed_emails" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "usage_periods" ADD COLUMN "overage_last_reported_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "usage_periods" ADD COLUMN "usage_warning_80_notified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "usage_periods" ADD COLUMN "usage_warning_100_notified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "billing_overage_reports" ADD CONSTRAINT "billing_overage_reports_usage_period_id_usage_periods_id_fk" FOREIGN KEY ("usage_period_id") REFERENCES "public"."usage_periods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "billing_overage_reports_report_key_idx" ON "billing_overage_reports" USING btree ("report_key");--> statement-breakpoint
CREATE INDEX "billing_overage_reports_usage_period_idx" ON "billing_overage_reports" USING btree ("usage_period_id");--> statement-breakpoint
CREATE INDEX "billing_overage_reports_status_idx" ON "billing_overage_reports" USING btree ("status");--> statement-breakpoint
CREATE INDEX "usage_periods_period_end_idx" ON "usage_periods" USING btree ("period_end");--> statement-breakpoint
UPDATE "plans"
SET "monthly_email_quota" = 500
WHERE "slug" = 'free';
