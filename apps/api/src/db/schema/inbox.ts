import { pgTable, uuid, text, timestamp, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { workspaces } from './workspaces';
import { users } from './users';
import { projects, type Visibility } from './projects';

export type InboxStatus = 'pending' | 'triaged' | 'dismissed';

/**
 * Quick-capture items — unstructured notes not yet assigned to a project.
 * Triage converts a `pending` item into a task in a project (status → triaged).
 */
export const inboxItems = pgTable(
  'inbox_items',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    capturedBy: uuid('captured_by')
      .notNull()
      .references(() => users.id),
    ownerId: uuid('owner_id').references(() => users.id),
    visibility: text('visibility').notNull().default('shared').$type<Visibility>(),
    status: text('status').notNull().default('pending').$type<InboxStatus>(),
    triagedToProjectId: uuid('triaged_to_project_id').references(() => projects.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    workspaceStatusIdx: index('idx_inbox_workspace_status').on(table.workspaceId, table.status),
    capturedByIdx: index('idx_inbox_captured_by').on(table.capturedBy),
  }),
);

export type InboxItem = typeof inboxItems.$inferSelect;
export type NewInboxItem = typeof inboxItems.$inferInsert;
