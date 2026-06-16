ALTER TABLE "users" ADD COLUMN "onboarded_at" timestamptz;
-- Existing users have already used the app; don't show them the new-user tour.
UPDATE "users" SET "onboarded_at" = now() WHERE "onboarded_at" IS NULL;
