ALTER TABLE "domains" ADD COLUMN "dkim_origin" varchar(16) DEFAULT 'AWS_SES' NOT NULL;--> statement-breakpoint
ALTER TABLE "domains" ADD COLUMN "dkim_selector" varchar(63);--> statement-breakpoint
ALTER TABLE "domains" ADD COLUMN "dkim_public_key" text;--> statement-breakpoint
ALTER TABLE "domains" ADD COLUMN "dkim_private_key_ct" text;--> statement-breakpoint
ALTER TABLE "domains" ADD COLUMN "dkim_private_key_iv" text;