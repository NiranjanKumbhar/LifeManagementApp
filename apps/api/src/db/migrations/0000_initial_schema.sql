-- LifeSync Initial Schema
-- Migration: 0000_initial_schema
--
-- DOWN (rollback):
-- DROP TABLE IF EXISTS notifications, activity_events, resources, people,
--   household_items, reminders, tasks, projects, project_templates,
--   workspace_members, users, workspaces CASCADE;

CREATE TABLE IF NOT EXISTS "workspaces" (
  "id"         uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name"       text NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "users" (
  "id"                       uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "clerk_id"                 text UNIQUE NOT NULL,
  "email"                    text UNIQUE NOT NULL,
  "display_name"             text NOT NULL,
  "avatar_url"               text,
  "timezone"                 text NOT NULL DEFAULT 'UTC',
  "notification_preferences" jsonb NOT NULL DEFAULT '{}',
  "created_at"               timestamptz DEFAULT now() NOT NULL,
  "updated_at"               timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "workspace_members" (
  "id"           uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "user_id"      uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "role"         text NOT NULL DEFAULT 'member' CHECK ("role" IN ('owner', 'member')),
  "invited_at"   timestamptz DEFAULT now() NOT NULL,
  "joined_at"    timestamptz,
  UNIQUE ("workspace_id", "user_id")
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "project_templates" (
  "id"             uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "type"           text NOT NULL CHECK ("type" IN ('occasion','compliance','household','health','travel','planning','general')),
  "name"           text NOT NULL,
  "description"    text,
  "default_tasks"  jsonb NOT NULL DEFAULT '[]',
  "default_fields" jsonb NOT NULL DEFAULT '{}',
  "is_system"      boolean NOT NULL DEFAULT false,
  "workspace_id"   uuid REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "created_at"     timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "projects" (
  "id"                   uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id"         uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "type"                 text NOT NULL CHECK ("type" IN ('occasion','compliance','household','health','travel','planning','general')),
  "title"                text NOT NULL,
  "description"          text,
  "status"               text NOT NULL DEFAULT 'active' CHECK ("status" IN ('active','completed','archived','on_hold')),
  "priority"             text NOT NULL DEFAULT 'medium' CHECK ("priority" IN ('urgent','high','medium','low','none')),
  "owner_id"             uuid REFERENCES "users"("id"),
  "visibility"           text NOT NULL DEFAULT 'shared' CHECK ("visibility" IN ('shared','mine_visible','private')),
  "due_date"             date,
  "earliest_action_date" date,
  "lead_time_days"       integer,
  "custom_fields"        jsonb NOT NULL DEFAULT '{}',
  "template_id"          uuid REFERENCES "project_templates"("id"),
  "is_recurring"         boolean NOT NULL DEFAULT false,
  "recurrence_rule"      jsonb,
  "completed_at"         timestamptz,
  "created_at"           timestamptz DEFAULT now() NOT NULL,
  "updated_at"           timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "tasks" (
  "id"              uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id"      uuid NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "parent_id"       uuid REFERENCES "tasks"("id") ON DELETE CASCADE,
  "title"           text NOT NULL,
  "description"     text,
  "status"          text NOT NULL DEFAULT 'pending' CHECK ("status" IN ('pending','in_progress','completed','cancelled','blocked')),
  "priority"        text NOT NULL DEFAULT 'medium' CHECK ("priority" IN ('urgent','high','medium','low','none')),
  "owner_id"        uuid REFERENCES "users"("id"),
  "due_date"        date,
  "sort_order"      integer NOT NULL DEFAULT 0,
  "path"            text NOT NULL DEFAULT '',
  "depends_on_id"   uuid REFERENCES "tasks"("id"),
  "is_recurring"    boolean NOT NULL DEFAULT false,
  "recurrence_rule" jsonb,
  "completed_at"    timestamptz,
  "completed_by"    uuid REFERENCES "users"("id"),
  "created_at"      timestamptz DEFAULT now() NOT NULL,
  "updated_at"      timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "reminders" (
  "id"            uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id"    uuid REFERENCES "projects"("id") ON DELETE CASCADE,
  "task_id"       uuid REFERENCES "tasks"("id") ON DELETE CASCADE,
  "user_id"       uuid NOT NULL REFERENCES "users"("id"),
  "remind_at"     timestamptz NOT NULL,
  "type"          text NOT NULL DEFAULT 'standard' CHECK ("type" IN ('standard','lead_time','escalation','recurring')),
  "severity"      text NOT NULL DEFAULT 'info' CHECK ("severity" IN ('info','warning','urgent','critical')),
  "message"       text,
  "is_sent"       boolean NOT NULL DEFAULT false,
  "sent_at"       timestamptz,
  "snoozed_until" timestamptz,
  "created_at"    timestamptz DEFAULT now() NOT NULL,
  CHECK ("project_id" IS NOT NULL OR "task_id" IS NOT NULL)
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "household_items" (
  "id"              uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id"    uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "name"            text NOT NULL,
  "category"        text NOT NULL DEFAULT 'other',
  "status"          text NOT NULL DEFAULT 'stocked' CHECK ("status" IN ('stocked','low','out','on_list')),
  "quantity"        integer,
  "unit"            text,
  "auto_replenish"  boolean NOT NULL DEFAULT false,
  "last_purchased"  timestamptz,
  "added_by"        uuid REFERENCES "users"("id"),
  "sort_order"      integer NOT NULL DEFAULT 0,
  "created_at"      timestamptz DEFAULT now() NOT NULL,
  "updated_at"      timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "people" (
  "id"            uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id"  uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "name"          text NOT NULL,
  "relationship"  text,
  "birthday"      date,
  "anniversary"   date,
  "email"         text,
  "phone"         text,
  "notes"         text,
  "gift_ideas"    jsonb NOT NULL DEFAULT '[]',
  "custom_fields" jsonb NOT NULL DEFAULT '{}',
  "created_at"    timestamptz DEFAULT now() NOT NULL,
  "updated_at"    timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "resources" (
  "id"           uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id"   uuid REFERENCES "projects"("id") ON DELETE CASCADE,
  "task_id"      uuid REFERENCES "tasks"("id") ON DELETE CASCADE,
  "person_id"    uuid REFERENCES "people"("id") ON DELETE CASCADE,
  "name"         text NOT NULL,
  "file_type"    text NOT NULL,
  "storage_path" text NOT NULL,
  "size_bytes"   bigint,
  "uploaded_by"  uuid NOT NULL REFERENCES "users"("id"),
  "created_at"   timestamptz DEFAULT now() NOT NULL,
  CHECK ("project_id" IS NOT NULL OR "task_id" IS NOT NULL OR "person_id" IS NOT NULL)
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "activity_events" (
  "id"           uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "user_id"      uuid NOT NULL REFERENCES "users"("id"),
  "entity_type"  text NOT NULL,
  "entity_id"    uuid NOT NULL,
  "action"       text NOT NULL,
  "changes"      jsonb,
  "created_at"   timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "notifications" (
  "id"           uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id"      uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "type"         text NOT NULL,
  "title"        text NOT NULL,
  "body"         text,
  "entity_type"  text,
  "entity_id"    uuid,
  "is_read"      boolean NOT NULL DEFAULT false,
  "read_at"      timestamptz,
  "created_at"   timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- Indexes
CREATE INDEX IF NOT EXISTS "idx_workspace_members_workspace" ON "workspace_members"("workspace_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_workspace_members_user" ON "workspace_members"("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_templates_type" ON "project_templates"("type");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_templates_workspace" ON "project_templates"("workspace_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_projects_workspace_status" ON "projects"("workspace_id", "status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_projects_workspace_type" ON "projects"("workspace_id", "type");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_projects_due_date" ON "projects"("due_date") WHERE "due_date" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_projects_owner" ON "projects"("owner_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_projects_visibility" ON "projects"("workspace_id", "visibility");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tasks_project" ON "tasks"("project_id", "sort_order");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tasks_parent" ON "tasks"("parent_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tasks_owner" ON "tasks"("owner_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tasks_due_date" ON "tasks"("due_date") WHERE "due_date" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tasks_path" ON "tasks"("path");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tasks_status" ON "tasks"("project_id", "status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_reminders_due" ON "reminders"("remind_at") WHERE "is_sent" = false;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_reminders_user" ON "reminders"("user_id", "is_sent");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_household_workspace" ON "household_items"("workspace_id", "category");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_household_status" ON "household_items"("workspace_id", "status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_people_workspace" ON "people"("workspace_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_people_birthday" ON "people"("birthday") WHERE "birthday" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_resources_project" ON "resources"("project_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_resources_task" ON "resources"("task_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_resources_person" ON "resources"("person_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_activity_workspace" ON "activity_events"("workspace_id", "created_at" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_activity_entity" ON "activity_events"("entity_type", "entity_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_notifications_user" ON "notifications"("user_id", "is_read", "created_at" DESC);
