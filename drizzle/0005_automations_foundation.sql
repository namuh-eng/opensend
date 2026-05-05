CREATE TABLE "automation_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"automation_id" uuid NOT NULL,
	"trigger_event_id" uuid,
	"contact_id" uuid,
	"status" varchar(50) DEFAULT 'queued' NOT NULL,
	"current_step_key" varchar(64),
	"step_states" jsonb,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"next_step_at" timestamp with time zone,
	"failure_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" text
);
--> statement-breakpoint
CREATE TABLE "automation_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"automation_id" uuid NOT NULL,
	"key" varchar(64) NOT NULL,
	"type" varchar(50) NOT NULL,
	"config" jsonb NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "automations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) DEFAULT 'Untitled' NOT NULL,
	"status" varchar(50) DEFAULT 'draft' NOT NULL,
	"trigger_event_name" varchar(255),
	"connections" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"document" jsonb,
	"user_id" text
);
--> statement-breakpoint
CREATE TABLE "contacts_to_segments" (
	"contact_id" uuid NOT NULL,
	"segment_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "custom_event_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_name" varchar(255) NOT NULL,
	"contact_id" uuid,
	"email" varchar(512),
	"payload" jsonb NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" text
);
--> statement-breakpoint
CREATE TABLE "custom_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"schema" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" text
);
--> statement-breakpoint
ALTER TABLE "automation_runs" ADD CONSTRAINT "automation_runs_automation_id_automations_id_fk" FOREIGN KEY ("automation_id") REFERENCES "public"."automations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_steps" ADD CONSTRAINT "automation_steps_automation_id_automations_id_fk" FOREIGN KEY ("automation_id") REFERENCES "public"."automations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts_to_segments" ADD CONSTRAINT "contacts_to_segments_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts_to_segments" ADD CONSTRAINT "contacts_to_segments_segment_id_segments_id_fk" FOREIGN KEY ("segment_id") REFERENCES "public"."segments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "automation_runs_status_next_step_at_idx" ON "automation_runs" USING btree ("status","next_step_at");--> statement-breakpoint
CREATE INDEX "automation_runs_automation_id_created_at_idx" ON "automation_runs" USING btree ("automation_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "automation_steps_automation_id_key_idx" ON "automation_steps" USING btree ("automation_id","key");--> statement-breakpoint
CREATE INDEX "automation_steps_automation_id_position_idx" ON "automation_steps" USING btree ("automation_id","position");--> statement-breakpoint
CREATE INDEX "automations_status_trigger_idx" ON "automations" USING btree ("status","trigger_event_name");--> statement-breakpoint
CREATE INDEX "automations_user_id_idx" ON "automations" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "contacts_to_segments_idx" ON "contacts_to_segments" USING btree ("contact_id","segment_id");--> statement-breakpoint
CREATE INDEX "contacts_to_segments_segment_id_idx" ON "contacts_to_segments" USING btree ("segment_id");--> statement-breakpoint
CREATE INDEX "custom_event_deliveries_event_name_idx" ON "custom_event_deliveries" USING btree ("event_name");--> statement-breakpoint
CREATE INDEX "custom_event_deliveries_received_at_idx" ON "custom_event_deliveries" USING btree ("received_at");--> statement-breakpoint
CREATE UNIQUE INDEX "custom_events_user_name_idx" ON "custom_events" USING btree ("user_id","name");