CREATE TABLE "receiving_routes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"domain_id" uuid NOT NULL,
	"type" varchar(20) NOT NULL,
	"local_part" varchar(320),
	"target_local_part" varchar(320) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "received_emails" ADD COLUMN "route_decisions" jsonb;--> statement-breakpoint
ALTER TABLE "receiving_routes" ADD CONSTRAINT "receiving_routes_domain_id_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."domains"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "receiving_routes_user_id_idx" ON "receiving_routes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "receiving_routes_domain_id_idx" ON "receiving_routes" USING btree ("domain_id");--> statement-breakpoint
CREATE UNIQUE INDEX "receiving_routes_domain_type_local_idx" ON "receiving_routes" USING btree ("domain_id","type","local_part");