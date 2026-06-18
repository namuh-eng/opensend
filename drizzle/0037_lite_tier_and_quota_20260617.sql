-- Tighten Free to 500/mo, trim Starter to 51,000/mo, and introduce the Lite tier ($10 / 15,000).
UPDATE "plans"
SET "monthly_email_quota" = 500
WHERE "slug" = 'free';--> statement-breakpoint
UPDATE "plans"
SET "monthly_email_quota" = 51000
WHERE "slug" = 'cloud_starter_55k_monthly';--> statement-breakpoint
-- Lite live Stripe price: price_1TjDBuQe1Ex4Xxd5JalaBwEP ($10/mo, product opensend_cloud).
INSERT INTO "plans" (
  "slug",
  "name",
  "monthly_price_cents",
  "monthly_email_quota",
  "max_domains",
  "max_api_keys",
  "stripe_price_id",
  "is_public"
)
VALUES ('cloud_lite_15k_monthly', 'Lite', 1000, 15000, 3, 5, 'price_1TjDBuQe1Ex4Xxd5JalaBwEP', true)
ON CONFLICT ("slug") DO UPDATE SET
  "name" = EXCLUDED."name",
  "monthly_price_cents" = EXCLUDED."monthly_price_cents",
  "monthly_email_quota" = EXCLUDED."monthly_email_quota",
  "max_domains" = EXCLUDED."max_domains",
  "max_api_keys" = EXCLUDED."max_api_keys",
  "stripe_price_id" = EXCLUDED."stripe_price_id",
  "is_public" = EXCLUDED."is_public";
