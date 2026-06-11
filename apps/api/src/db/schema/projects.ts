import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  date,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { workspaces } from './workspaces';
import { users } from './users';

export type ProjectType =
  | 'occasion'
  | 'compliance'
  | 'household'
  | 'health'
  | 'travel'
  | 'planning'
  | 'general';
export type ProjectStatus = 'active' | 'completed' | 'archived' | 'on_hold';
export type Priority = 'urgent' | 'high' | 'medium' | 'low' | 'none';
export type Visibility = 'shared' | 'mine_visible' | 'private';

export const projectTemplates = pgTable(
  'project_templates',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    type: text('type').notNull().$type<ProjectType>(),
    name: text('name').notNull(),
    description: text('description'),
    defaultTasks: jsonb('default_tasks')
      .notNull()
      .default([])
      .$type<Array<{ title: string; description?: string }>>(),
    defaultFields: jsonb('default_fields')
      .notNull()
      .default({})
      .$type<Record<string, unknown>>(),
    isSystem: boolean('is_system').notNull().default(false),
    workspaceId: uuid('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    typeIdx: index('idx_templates_type').on(table.type),
    workspaceIdx: index('idx_templates_workspace').on(table.workspaceId),
  }),
);

export const projects = pgTable(
  'projects',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    type: text('type').notNull().$type<ProjectType>(),
    title: text('title').notNull(),
    description: text('description'),
    status: text('status').notNull().default('active').$type<ProjectStatus>(),
    priority: text('priority').notNull().default('medium').$type<Priority>(),
    ownerId: uuid('owner_id').references(() => users.id),
    visibility: text('visibility').notNull().default('shared').$type<Visibility>(),
    dueDate: date('due_date'),
    earliestActionDate: date('earliest_action_date'),
    leadTimeDays: integer('lead_time_days'),
    customFields: jsonb('custom_fields')
      .notNull()
      .default({})
      .$type<Record<string, unknown>>(),
    templateId: uuid('template_id').references(() => projectTemplates.id),
    isRecurring: boolean('is_recurring').notNull().default(false),
    recurrenceRule: jsonb('recurrence_rule').$type<Record<string, unknown>>(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    workspaceStatusIdx: index('idx_projects_workspace_status').on(
      table.workspaceId,
      table.status,
    ),
    workspaceTypeIdx: index('idx_projects_workspace_type').on(table.workspaceId, table.type),
    dueDateIdx: index('idx_projects_due_date').on(table.dueDate),
    ownerIdx: index('idx_projects_owner').on(table.ownerId),
    visibilityIdx: index('idx_projects_visibility').on(table.workspaceId, table.visibility),
  }),
);

export type ProjectTemplate = typeof projectTemplates.$inferSelect;
export type NewProjectTemplate = typeof projectTemplates.$inferInsert;
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
