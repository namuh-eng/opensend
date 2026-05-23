CREATE TABLE "dedicated_ip_pools" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" varchar(255) NOT NULL,
	"ses_pool_name" varchar(255) NOT NULL,
	"scaling_mode" varchar(20) DEFAULT 'MANAGED' NOT NULL,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "domains" ADD COLUMN "dedicated_ip_pool_id" uuid;--> statement-breakpoint
ALTER TABLE "domains" ADD COLUMN "ses_configuration_set_name" varchar(255);--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN "dedicated_ips_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN "max_dedicated_ips" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "dedicated_ip_pools_ses_pool_name_idx" ON "dedicated_ip_pools" USING btree ("ses_pool_name");--> statement-breakpoint
CREATE INDEX "dedicated_ip_pools_user_id_idx" ON "dedicated_ip_pools" USING btree ("user_id");