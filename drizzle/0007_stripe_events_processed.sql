CREATE TABLE "stripe_events_processed" (
	"event_id" varchar(255) PRIMARY KEY NOT NULL,
	"type" varchar(255) NOT NULL,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "stripe_events_processed_processed_at_idx" ON "stripe_events_processed" USING btree ("processed_at");