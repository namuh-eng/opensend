CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"actor_type" varchar(32) NOT NULL,
	"actor_id" text NOT NULL,
	"actor_email" text,
	"action" varchar(100) NOT NULL,
	"target_type" varchar(64) NOT NULL,
	"target_id" text NOT NULL,
	"source" varchar(32) NOT NULL,
	"source_api_key_id" uuid,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "audit_events_user_created_at_idx" ON "audit_events" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_events_user_action_idx" ON "audit_events" USING btree ("user_id","action");--> statement-breakpoint
CREATE INDEX "audit_events_source_api_key_idx" ON "audit_events" USING btree ("source_api_key_id");