CREATE TABLE "inbound_provider_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" varchar(50) NOT NULL,
	"provider_event_id" varchar(255) NOT NULL,
	"provider_message_id" varchar(255),
	"status" varchar(50) DEFAULT 'processing' NOT NULL,
	"terminal_reason" text,
	"raw_metadata" jsonb NOT NULL,
	"user_id" text,
	"received_email_id" uuid,
	"duplicate_of_event_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "inbound_provider_events_provider_event_idx" ON "inbound_provider_events" USING btree ("provider","provider_event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "inbound_provider_events_primary_event_idx" ON "inbound_provider_events" USING btree ("provider","provider_event_id") WHERE "status" <> 'duplicate_provider_event';--> statement-breakpoint
CREATE INDEX "inbound_provider_events_status_idx" ON "inbound_provider_events" USING btree ("status");--> statement-breakpoint
CREATE INDEX "inbound_provider_events_user_created_at_idx" ON "inbound_provider_events" USING btree ("user_id","created_at");
