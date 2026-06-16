-- Collapse visibility to two tiers (shared / private). mine_visible was visible
-- to all members, so it maps to shared.
UPDATE "projects" SET "visibility" = 'shared' WHERE "visibility" = 'mine_visible';
UPDATE "inbox_items" SET "visibility" = 'shared' WHERE "visibility" = 'mine_visible';

-- New per-item visibility on tasks and household items (default shared).
ALTER TABLE "tasks" ADD COLUMN "visibility" text NOT NULL DEFAULT 'shared'
  CHECK ("visibility" IN ('shared','private'));
ALTER TABLE "household_items" ADD COLUMN "visibility" text NOT NULL DEFAULT 'shared'
  CHECK ("visibility" IN ('shared','private'));
