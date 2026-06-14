-- Allow standalone reminders that are not tied to a project or task.
-- The original schema enforced (project_id IS NOT NULL OR task_id IS NOT NULL),
-- but we now support reminders such as personal time-based alerts.
ALTER TABLE "reminders" DROP CONSTRAINT IF EXISTS "reminders_check";
