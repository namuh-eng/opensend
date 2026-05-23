CREATE TABLE "unsubscribe_page_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"logo_url" varchar(2048),
	"brand_color" varchar(9) DEFAULT '#10b981' NOT NULL,
	"headline" varchar(200) DEFAULT 'Unsubscribed successfully' NOT NULL,
	"message" varchar(1000) DEFAULT 'You have been removed from this mailing list. You will no longer receive marketing emails from this sender.' NOT NULL,
	"footer_text" varchar(200) DEFAULT 'Powered by OpenSend' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "unsubscribe_page_settings_user_id_idx" ON "unsubscribe_page_settings" USING btree ("user_id");