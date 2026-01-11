-- Admin + VIP support
-- 1) Optional email field for users (admin identification)
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "email" varchar(160);

-- Unique email when provided (partial unique index)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'users_email_unique'
  ) THEN
    CREATE UNIQUE INDEX users_email_unique ON "users" ("email") WHERE "email" IS NOT NULL;
  END IF;
END $$;

-- 2) VIP flag on profiles (admin-managed)
ALTER TABLE "profiles"
  ADD COLUMN IF NOT EXISTS "is_vip" boolean NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'profiles_is_vip_idx'
  ) THEN
    CREATE INDEX profiles_is_vip_idx ON "profiles" ("is_vip");
  END IF;
END $$;


