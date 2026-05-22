DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'user_gender'
  ) THEN
    CREATE TYPE "user_gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');
  END IF;
END $$;

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "cover_url" TEXT,
  ADD COLUMN IF NOT EXISTS "gender" "user_gender",
  ADD COLUMN IF NOT EXISTS "date_of_birth" DATE;
