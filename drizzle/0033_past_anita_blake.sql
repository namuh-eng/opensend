CREATE TABLE "domain_deliverability_statuses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"domain_id" uuid NOT NULL,
	"bimi_selector" varchar(63) DEFAULT 'default' NOT NULL,
	"bimi_status" varchar(32) DEFAULT 'not_configured' NOT NULL,
	"bimi_logo_url" varchar(2048),
	"bimi_certificate_url" varchar(2048),
	"bimi_notes" text,
	"apple_branded_mail_status" varchar(32) DEFAULT 'not_started' NOT NULL,
	"apple_branded_mail_notes" text,
	"last_checked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "dedicated_ip_pools" ALTER COLUMN "status" SET DEFAULT 'requested';--> statement-breakpoint
ALTER TABLE "dedicated_ip_pools" ADD COLUMN "provider" varchar(50) DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "dedicated_ip_pools" ADD COLUMN "operator_notes" text;--> statement-breakpoint
ALTER TABLE "dedicated_ip_pools" ADD COLUMN "provisioned_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "dedicated_ip_pools" ADD COLUMN "warming_started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "dedicated_ip_pools" ADD COLUMN "retired_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "domain_deliverability_statuses_domain_id_idx" ON "domain_deliverability_statuses" USING btree ("domain_id");--> statement-breakpoint
CREATE INDEX "domain_deliverability_statuses_user_id_idx" ON "domain_deliverability_statuses" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "domain_deliverability_statuses_user_domain_idx" ON "domain_deliverability_statuses" USING btree ("user_id","domain_id");