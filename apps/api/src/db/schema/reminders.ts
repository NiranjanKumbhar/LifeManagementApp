import { pgTable, uuid, text, timestamp, boolean, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { projects } from './projects';
import { tasks } from './tasks';
import { users } from './users';

export type ReminderType = 'standard' | 'lead_time' | 'escalation' | 'recurring';
export type Severity = 'info' | 'warning' | 'urgent' | 'critical';

export const reminders = pgTable(
  'reminders',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }),
    taskId: uuid('task_id').references(() => tasks.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull().references(() => users.id),
    remindAt: timestamp('remind_at', { withTimezone: true }).notNull(),
    type: text('type').notNull().default('standard').$type<ReminderType>(),
    severity: text('severity').notNull().default('info').$type<Severity>(),
    message: text('message'),
    isSent: boolean('is_sent').notNull().default(false),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    snoozedUntil: timestamp('snoozed_until', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    dueIdx: index('idx_reminders_due').on(table.remindAt),
    userIdx: index('idx_reminders_user').on(table.userId, table.isSent),
  }),
);

export type Reminder = typeof reminders.$inferSelect;
export type NewReminder = typeof reminders.$inferInsert;
