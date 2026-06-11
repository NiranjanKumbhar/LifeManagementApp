-- LifeSync Migration: 0001_inbox_items
-- Adds the quick-capture inbox table.
--
-- DOWN (rollback):
-- DROP TABLE IF EXISTS "inbox_items" CASCADE;

CREATE TABLE IF NOT EXISTS "inbox_items" (
  "id"                     uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id"           uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "content"                text NOT NULL,
  "captured_by"            uuid NOT NULL REFERENCES "users"("id"),
  "owner_id"               uuid REFERENCES "users"("id"),
  "visibility"             text NOT NULL DEFAULT 'shared' CHECK ("visibility" IN ('shared','mine_visible','private')),
  "status"                 text NOT NULL DEFAULT 'pending' CHECK ("status" IN ('pending','triaged','dismissed')),
  "triaged_to_project_id"  uuid REFERENCES "projects"("id") ON DELETE SET NULL,
  "created_at"             timestamptz DEFAULT now() NOT NULL,
  "updated_at"             timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_inbox_workspace_status" ON "inbox_items"("workspace_id", "status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_inbox_captured_by" ON "inbox_items"("captured_by");
