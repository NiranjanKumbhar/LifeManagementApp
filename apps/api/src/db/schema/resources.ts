import { pgTable, uuid, text, timestamp, bigint, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { projects } from './projects';
import { tasks } from './tasks';
import { people } from './people';
import { users } from './users';

export const resources = pgTable(
  'resources',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }),
    taskId: uuid('task_id').references(() => tasks.id, { onDelete: 'cascade' }),
    personId: uuid('person_id').references(() => people.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    fileType: text('file_type').notNull(),
    storagePath: text('storage_path').notNull(),
    sizeBytes: bigint('size_bytes', { mode: 'number' }),
    uploadedBy: uuid('uploaded_by')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    projectIdx: index('idx_resources_project').on(table.projectId),
    taskIdx: index('idx_resources_task').on(table.taskId),
    personIdx: index('idx_resources_person').on(table.personId),
  }),
);

export type Resource = typeof resources.$inferSelect;
export type NewResource = typeof resources.$inferInsert;
