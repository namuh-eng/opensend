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
VALUES ('free', 'Free', 0, 5000, 1, 2, NULL, true)
ON CONFLICT ("slug") DO UPDATE SET
  "name" = EXCLUDED."name",
  "monthly_price_cents" = EXCLUDED."monthly_price_cents",
  "monthly_email_quota" = EXCLUDED."monthly_email_quota",
  "max_domains" = EXCLUDED."max_domains",
  "max_api_keys" = EXCLUDED."max_api_keys",
  "stripe_price_id" = EXCLUDED."stripe_price_id",
  "is_public" = EXCLUDED."is_public";--> statement-breakpoint
WITH starter_candidate AS (
  SELECT "id"
  FROM "plans"
  WHERE "slug" IN ('cloud_starter_55k_monthly', 'cloud_starter_monthly', 'starter')
  ORDER BY CASE "slug"
    WHEN 'cloud_starter_55k_monthly' THEN 0
    WHEN 'cloud_starter_monthly' THEN 1
    ELSE 2
  END
  LIMIT 1
),
starter_update AS (
  UPDATE "plans"
  SET
    "slug" = 'cloud_starter_55k_monthly',
    "name" = 'Starter',
    "monthly_price_cents" = 1900,
    "monthly_email_quota" = 55000,
    "max_domains" = 10,
    "max_api_keys" = 10,
    "stripe_price_id" = 'price_1TXtMCQe1Ex4Xxd5rFHBIDm1',
    "is_public" = true
  WHERE "id" = (SELECT "id" FROM starter_candidate)
  RETURNING "id"
)
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
SELECT 'cloud_starter_55k_monthly', 'Starter', 1900, 55000, 10, 10, 'price_1TXtMCQe1Ex4Xxd5rFHBIDm1', true
WHERE NOT EXISTS (SELECT 1 FROM starter_update)
ON CONFLICT ("slug") DO UPDATE SET
  "name" = EXCLUDED."name",
  "monthly_price_cents" = EXCLUDED."monthly_price_cents",
  "monthly_email_quota" = EXCLUDED."monthly_email_quota",
  "max_domains" = EXCLUDED."max_domains",
  "max_api_keys" = EXCLUDED."max_api_keys",
  "stripe_price_id" = EXCLUDED."stripe_price_id",
  "is_public" = EXCLUDED."is_public";--> statement-breakpoint
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
VALUES ('cloud_starter_100k_monthly', 'Starter', 3500, 100000, 10, 10, 'price_1TXtMCQe1Ex4Xxd515fpQX93', true)
ON CONFLICT ("slug") DO UPDATE SET
  "name" = EXCLUDED."name",
  "monthly_price_cents" = EXCLUDED."monthly_price_cents",
  "monthly_email_quota" = EXCLUDED."monthly_email_quota",
  "max_domains" = EXCLUDED."max_domains",
  "max_api_keys" = EXCLUDED."max_api_keys",
  "stripe_price_id" = EXCLUDED."stripe_price_id",
  "is_public" = EXCLUDED."is_public";--> statement-breakpoint
WITH growth_candidate AS (
  SELECT "id"
  FROM "plans"
  WHERE "slug" IN ('cloud_growth_120k_monthly', 'cloud_growth_monthly', 'growth')
  ORDER BY CASE "slug"
    WHEN 'cloud_growth_120k_monthly' THEN 0
    WHEN 'cloud_growth_monthly' THEN 1
    ELSE 2
  END
  LIMIT 1
),
growth_update AS (
  UPDATE "plans"
  SET
    "slug" = 'cloud_growth_120k_monthly',
    "name" = 'Growth',
    "monthly_price_cents" = 9900,
    "monthly_email_quota" = 120000,
    "max_domains" = 1000,
    "max_api_keys" = 25,
    "stripe_price_id" = 'price_1TXtMDQe1Ex4Xxd5mggWy1I7',
    "is_public" = true
  WHERE "id" = (SELECT "id" FROM growth_candidate)
  RETURNING "id"
)
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
SELECT 'cloud_growth_120k_monthly', 'Growth', 9900, 120000, 1000, 25, 'price_1TXtMDQe1Ex4Xxd5mggWy1I7', true
WHERE NOT EXISTS (SELECT 1 FROM growth_update)
ON CONFLICT ("slug") DO UPDATE SET
  "name" = EXCLUDED."name",
  "monthly_price_cents" = EXCLUDED."monthly_price_cents",
  "monthly_email_quota" = EXCLUDED."monthly_email_quota",
  "max_domains" = EXCLUDED."max_domains",
  "max_api_keys" = EXCLUDED."max_api_keys",
  "stripe_price_id" = EXCLUDED."stripe_price_id",
  "is_public" = EXCLUDED."is_public";--> statement-breakpoint
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
VALUES
  ('cloud_growth_250k_monthly', 'Growth', 16000, 250000, 1000, 25, 'price_1TXtMDQe1Ex4Xxd512n1Bwl9', true),
  ('cloud_growth_500k_monthly', 'Growth', 35000, 500000, 1000, 25, 'price_1TXtMEQe1Ex4Xxd5qF7r2872', true)
ON CONFLICT ("slug") DO UPDATE SET
  "name" = EXCLUDED."name",
  "monthly_price_cents" = EXCLUDED."monthly_price_cents",
  "monthly_email_quota" = EXCLUDED."monthly_email_quota",
  "max_domains" = EXCLUDED."max_domains",
  "max_api_keys" = EXCLUDED."max_api_keys",
  "stripe_price_id" = EXCLUDED."stripe_price_id",
  "is_public" = EXCLUDED."is_public";--> statement-breakpoint
UPDATE "plans"
SET "is_public" = false
WHERE "slug" IN ('starter', 'cloud_starter_monthly', 'growth', 'cloud_growth_monthly', 'scale', 'cloud_scale_monthly');
