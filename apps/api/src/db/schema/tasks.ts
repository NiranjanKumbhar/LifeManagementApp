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
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { projects } from './projects';
import type { Visibility } from './projects';
import { users } from './users';

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'blocked';

export const tasks = pgTable(
  'tasks',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    parentId: uuid('parent_id').references((): AnyPgColumn => tasks.id, {
      onDelete: 'cascade',
    }),
    title: text('title').notNull(),
    description: text('description'),
    status: text('status').notNull().default('pending').$type<TaskStatus>(),
    priority: text('priority').notNull().default('medium'),
    ownerId: uuid('owner_id').references(() => users.id, { onDelete: 'set null' }),
    dueDate: date('due_date'),
    sortOrder: integer('sort_order').notNull().default(0),
    // Materialized path for efficient subtree queries (e.g. "root-id.parent-id.child-id")
    path: text('path').notNull().default(''),
    dependsOnId: uuid('depends_on_id').references((): AnyPgColumn => tasks.id),
    isRecurring: boolean('is_recurring').notNull().default(false),
    recurrenceRule: jsonb('recurrence_rule').$type<Record<string, unknown>>(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    completedBy: uuid('completed_by').references(() => users.id, { onDelete: 'set null' }),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    visibility: text('visibility').notNull().default('shared').$type<Visibility>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    projectIdx: index('idx_tasks_project').on(table.projectId, table.sortOrder),
    parentIdx: index('idx_tasks_parent').on(table.parentId),
    ownerIdx: index('idx_tasks_owner').on(table.ownerId),
    dueDateIdx: index('idx_tasks_due_date').on(table.dueDate),
    pathIdx: index('idx_tasks_path').on(table.path),
    statusIdx: index('idx_tasks_status').on(table.projectId, table.status),
  }),
);

export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
