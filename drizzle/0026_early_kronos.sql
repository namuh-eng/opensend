CREATE TABLE "dashboard_export_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_by_email" text,
	"resource" varchar(64) NOT NULL,
	"status" varchar(32) DEFAULT 'completed' NOT NULL,
	"format" varchar(16) DEFAULT 'csv' NOT NULL,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"filters" jsonb NOT NULL,
	"filename" varchar(255) NOT NULL,
	"content" text,
	"row_count" integer DEFAULT 0 NOT NULL,
	"byte_size" integer DEFAULT 0 NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"downloaded_at" timestamp with time zone,
	"download_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX "dashboard_export_jobs_user_created_at_idx" ON "dashboard_export_jobs" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "dashboard_export_jobs_user_status_idx" ON "dashboard_export_jobs" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "dashboard_export_jobs_expires_at_idx" ON "dashboard_export_jobs" USING btree ("expires_at");