ALTER TABLE "dedicated_ip_pools" ADD COLUMN "aws_region" varchar(32);--> statement-breakpoint
ALTER TABLE "dedicated_ip_pools" ADD COLUMN "last_synced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "dedicated_ip_pools" ADD COLUMN "ip_count" integer;