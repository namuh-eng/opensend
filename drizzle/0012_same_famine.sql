DROP INDEX "emails_idempotency_key_idx";--> statement-breakpoint
CREATE INDEX "emails_user_created_at_idx" ON "emails" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "emails_user_id_idempotency_key_idx" ON "emails" USING btree ("user_id","idempotency_key");