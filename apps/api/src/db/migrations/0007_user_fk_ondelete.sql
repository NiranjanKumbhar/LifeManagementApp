-- SET NULL: nullable attribution (content survives; attribution becomes NULL)
ALTER TABLE "projects" DROP CONSTRAINT IF EXISTS "projects_owner_id_fkey",
  ADD CONSTRAINT "projects_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL;
ALTER TABLE "projects" DROP CONSTRAINT IF EXISTS "projects_created_by_fkey",
  ADD CONSTRAINT "projects_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL;
ALTER TABLE "projects" DROP CONSTRAINT IF EXISTS "projects_completed_by_fkey",
  ADD CONSTRAINT "projects_completed_by_fkey" FOREIGN KEY ("completed_by") REFERENCES "users"("id") ON DELETE SET NULL;
ALTER TABLE "tasks" DROP CONSTRAINT IF EXISTS "tasks_owner_id_fkey",
  ADD CONSTRAINT "tasks_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL;
ALTER TABLE "tasks" DROP CONSTRAINT IF EXISTS "tasks_completed_by_fkey",
  ADD CONSTRAINT "tasks_completed_by_fkey" FOREIGN KEY ("completed_by") REFERENCES "users"("id") ON DELETE SET NULL;
ALTER TABLE "tasks" DROP CONSTRAINT IF EXISTS "tasks_created_by_fkey",
  ADD CONSTRAINT "tasks_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL;
ALTER TABLE "household_items" DROP CONSTRAINT IF EXISTS "household_items_added_by_fkey",
  ADD CONSTRAINT "household_items_added_by_fkey" FOREIGN KEY ("added_by") REFERENCES "users"("id") ON DELETE SET NULL;
ALTER TABLE "household_items" DROP CONSTRAINT IF EXISTS "household_items_last_purchased_by_fkey",
  ADD CONSTRAINT "household_items_last_purchased_by_fkey" FOREIGN KEY ("last_purchased_by") REFERENCES "users"("id") ON DELETE SET NULL;
ALTER TABLE "inbox_items" DROP CONSTRAINT IF EXISTS "inbox_items_owner_id_fkey",
  ADD CONSTRAINT "inbox_items_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL;
ALTER TABLE "workspace_invites" DROP CONSTRAINT IF EXISTS "workspace_invites_accepted_by_fkey",
  ADD CONSTRAINT "workspace_invites_accepted_by_fkey" FOREIGN KEY ("accepted_by") REFERENCES "users"("id") ON DELETE SET NULL;

-- CASCADE: the user's own NOT NULL rows (removed with them)
ALTER TABLE "activity_events" DROP CONSTRAINT IF EXISTS "activity_events_user_id_fkey",
  ADD CONSTRAINT "activity_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
ALTER TABLE "reminders" DROP CONSTRAINT IF EXISTS "reminders_user_id_fkey",
  ADD CONSTRAINT "reminders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
ALTER TABLE "inbox_items" DROP CONSTRAINT IF EXISTS "inbox_items_captured_by_fkey",
  ADD CONSTRAINT "inbox_items_captured_by_fkey" FOREIGN KEY ("captured_by") REFERENCES "users"("id") ON DELETE CASCADE;
ALTER TABLE "resources" DROP CONSTRAINT IF EXISTS "resources_uploaded_by_fkey",
  ADD CONSTRAINT "resources_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE CASCADE;
ALTER TABLE "workspace_invites" DROP CONSTRAINT IF EXISTS "workspace_invites_invited_by_fkey",
  ADD CONSTRAINT "workspace_invites_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "users"("id") ON DELETE CASCADE;
-- notifications.user_id is already cascade in the Drizzle schema; ensure prod matches
-- (idempotent) so a user with notifications can be deleted.
ALTER TABLE "notifications" DROP CONSTRAINT IF EXISTS "notifications_user_id_fkey",
  ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
