CREATE TABLE "scheduler_heartbeats" (
	"job_name" text PRIMARY KEY NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_result" jsonb
);
