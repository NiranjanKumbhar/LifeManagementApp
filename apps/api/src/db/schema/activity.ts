import { pgTable, uuid, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { workspaces } from './workspaces';
import { users } from './users';

export type ActivityAction = 'created' | 'updated' | 'completed' | 'archived' | 'deleted';
export type ChangeRecord = Record<string, { old: unknown; new: unknown }>;

export const activityEvents = pgTable(
  'activity_events',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull().references(() => users.id),
    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id').notNull(),
    action: text('action').notNull().$type<ActivityAction>(),
    changes: jsonb('changes').$type<ChangeRecord>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    workspaceIdx: index('idx_activity_workspace').on(table.workspaceId, table.createdAt),
    entityIdx: index('idx_activity_entity').on(table.entityType, table.entityId),
  }),
);

export type ActivityEvent = typeof activityEvents.$inferSelect;
export type NewActivityEvent = typeof activityEvents.$inferInsert;
