ALTER TABLE "logs" ADD COLUMN IF NOT EXISTS "document" jsonb;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "emails_tags_gin_idx" ON "emails" USING gin ("tags");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "logs_user_created_at_idx" ON "logs" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "logs_document_gin_idx" ON "logs" USING gin ("document");
