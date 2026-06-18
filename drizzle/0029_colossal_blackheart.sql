CREATE TABLE "forwarding_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"rule_id" uuid,
	"received_email_id" uuid NOT NULL,
	"forwarded_email_id" uuid,
	"status" varchar(32) NOT NULL,
	"reason" varchar(64) NOT NULL,
	"destinations" jsonb NOT NULL,
	"provider_message_id" varchar(255),
	"retry_eligible" boolean DEFAULT false NOT NULL,
	"error_code" varchar(255),
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "forwarding_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"domain_id" uuid NOT NULL,
	"route_id" uuid NOT NULL,
	"destinations" jsonb NOT NULL,
	"status" varchar(32) DEFAULT 'active' NOT NULL,
	"invalid_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "forwarding_attempts" ADD CONSTRAINT "forwarding_attempts_rule_id_forwarding_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."forwarding_rules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forwarding_attempts" ADD CONSTRAINT "forwarding_attempts_received_email_id_received_emails_id_fk" FOREIGN KEY ("received_email_id") REFERENCES "public"."received_emails"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forwarding_attempts" ADD CONSTRAINT "forwarding_attempts_forwarded_email_id_emails_id_fk" FOREIGN KEY ("forwarded_email_id") REFERENCES "public"."emails"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forwarding_rules" ADD CONSTRAINT "forwarding_rules_domain_id_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."domains"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forwarding_rules" ADD CONSTRAINT "forwarding_rules_route_id_receiving_routes_id_fk" FOREIGN KEY ("route_id") REFERENCES "public"."receiving_routes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "forwarding_attempts_user_created_at_idx" ON "forwarding_attempts" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "forwarding_attempts_received_email_id_idx" ON "forwarding_attempts" USING btree ("received_email_id");--> statement-breakpoint
CREATE INDEX "forwarding_attempts_rule_id_idx" ON "forwarding_attempts" USING btree ("rule_id");--> statement-breakpoint
CREATE INDEX "forwarding_attempts_forwarded_email_id_idx" ON "forwarding_attempts" USING btree ("forwarded_email_id");--> statement-breakpoint
CREATE INDEX "forwarding_rules_user_id_idx" ON "forwarding_rules" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "forwarding_rules_domain_id_idx" ON "forwarding_rules" USING btree ("domain_id");--> statement-breakpoint
CREATE UNIQUE INDEX "forwarding_rules_route_id_idx" ON "forwarding_rules" USING btree ("route_id");