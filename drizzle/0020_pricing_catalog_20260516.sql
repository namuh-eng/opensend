UPDATE "plans"
SET
  "monthly_email_quota" = 5000,
  "max_api_keys" = 2
WHERE "slug" = 'free';--> statement-breakpoint
UPDATE "plans"
SET
  "monthly_price_cents" = 1900,
  "monthly_email_quota" = 55000,
  "max_domains" = 10,
  "max_api_keys" = 10
WHERE "slug" = 'starter';--> statement-breakpoint
UPDATE "plans"
SET
  "monthly_price_cents" = 9900,
  "monthly_email_quota" = 120000,
  "max_domains" = 1000,
  "max_api_keys" = 25
WHERE "slug" = 'growth';--> statement-breakpoint
UPDATE "plans"
SET
  "monthly_price_cents" = 29900,
  "monthly_email_quota" = 1000000,
  "max_domains" = 100,
  "max_api_keys" = 100
WHERE "slug" = 'scale';
