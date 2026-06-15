-- Attribution: record who created / completed shared items.
ALTER TABLE "tasks"            ADD COLUMN "created_by"         uuid REFERENCES "users"("id");
ALTER TABLE "projects"         ADD COLUMN "created_by"         uuid REFERENCES "users"("id");
ALTER TABLE "projects"         ADD COLUMN "completed_by"       uuid REFERENCES "users"("id");
ALTER TABLE "household_items"  ADD COLUMN "last_purchased_by"  uuid REFERENCES "users"("id");

-- Backfill projects.created_by from the owner (owner defaulted to the creator).
UPDATE "projects" SET "created_by" = "owner_id" WHERE "created_by" IS NULL;

-- Backfill tasks.created_by from the 'created' activity event where one exists.
UPDATE "tasks" t
SET "created_by" = ae."user_id"
FROM "activity_events" ae
WHERE ae."entity_type" = 'task'
  AND ae."action" = 'created'
  AND ae."entity_id" = t."id"
  AND t."created_by" IS NULL;
