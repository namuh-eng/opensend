-- Reconcile "api_keys" with the @opensend/core schema.
--
-- Drift fix: the 0001 snapshot recorded the token-hash shape of api_keys
-- (token_hash / token_preview / domain / last_used_at / document) but NO DDL
-- was ever emitted for it. Databases provisioned via the migrator therefore
-- still carry the legacy 0000 shape (hashed_key / key_prefix / domain_id /
-- permission enum), so every api-key lookup
--   select ... token_hash ... from api_keys where token_hash = $1
-- fails with "column api_keys.token_hash does not exist" (Sentry OPENSEND-WEB-3/4,
-- culprit GET /api/emails/[id]).
--
-- This migration bridges legacy databases to the current schema and is a no-op
-- on databases already in the target shape (db:push / fresh installs).

-- 1. Add the token-hash columns (nullable first so we can backfill).
DO $$ BEGIN ALTER TABLE "api_keys" ADD COLUMN "token_hash" text; EXCEPTION WHEN duplicate_column THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "api_keys" ADD COLUMN "token_preview" varchar(50); EXCEPTION WHEN duplicate_column THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "api_keys" ADD COLUMN "domain" varchar(255); EXCEPTION WHEN duplicate_column THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "api_keys" ADD COLUMN "last_used_at" timestamp with time zone; EXCEPTION WHEN duplicate_column THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "api_keys" ADD COLUMN "document" jsonb; EXCEPTION WHEN duplicate_column THEN NULL; END $$;--> statement-breakpoint

-- 2. Backfill from legacy columns so existing rows satisfy NOT NULL + uniqueness.
--    NOTE: legacy keys were hashed by the pre-token_hash scheme; backfilling keeps
--    the rows valid but such keys may need re-issuing if they predate sha256 hashing.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'api_keys' AND column_name = 'hashed_key') THEN
    UPDATE "api_keys" SET "token_hash" = "hashed_key" WHERE "token_hash" IS NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'api_keys' AND column_name = 'key_prefix') THEN
    UPDATE "api_keys" SET "token_preview" = "key_prefix" WHERE "token_preview" IS NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'api_keys' AND column_name = 'domain_id') THEN
    UPDATE "api_keys" SET "domain" = "domain_id"::text WHERE "domain" IS NULL AND "domain_id" IS NOT NULL;
  END IF;
END $$;--> statement-breakpoint

-- 3. permission: enum permission_type -> varchar(50) with default 'full_access'.
DO $$ BEGIN
  ALTER TABLE "api_keys" ALTER COLUMN "permission" TYPE varchar(50) USING "permission"::text;
EXCEPTION WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; END $$;--> statement-breakpoint
ALTER TABLE "api_keys" ALTER COLUMN "permission" SET DEFAULT 'full_access';--> statement-breakpoint

-- 4. Drop legacy columns (their constraints, incl. the domain_id FK and the
--    hashed_key unique constraint, drop with the columns).
ALTER TABLE "api_keys" DROP COLUMN IF EXISTS "hashed_key";--> statement-breakpoint
ALTER TABLE "api_keys" DROP COLUMN IF EXISTS "key_prefix";--> statement-breakpoint
ALTER TABLE "api_keys" DROP COLUMN IF EXISTS "domain_id";--> statement-breakpoint

-- 5. Enforce NOT NULL + unique index on token_hash to match the schema.
DELETE FROM "api_keys" WHERE "token_hash" IS NULL;--> statement-breakpoint
ALTER TABLE "api_keys" ALTER COLUMN "token_hash" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "api_keys_token_hash_idx" ON "api_keys" USING btree ("token_hash");
