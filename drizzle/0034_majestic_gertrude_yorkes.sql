CREATE TABLE "integration_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"provider" varchar(64) NOT NULL,
	"name" varchar(255) NOT NULL,
	"status" varchar(32) DEFAULT 'connected' NOT NULL,
	"scopes" jsonb NOT NULL,
	"config" jsonb NOT NULL,
	"credentials_enc" text NOT NULL,
	"health_status" varchar(32) DEFAULT 'unknown' NOT NULL,
	"last_health_check_at" timestamp with time zone,
	"last_sync_at" timestamp with time zone,
	"last_event_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "integration_connections_user_provider_idx" ON "integration_connections" USING btree ("user_id","provider");--> statement-breakpoint
CREATE INDEX "integration_connections_user_status_idx" ON "integration_connections" USING btree ("user_id","status");