import { pgTable, uuid, text, timestamp, date, jsonb, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { workspaces } from './workspaces';

export type GiftIdea = { idea: string; budget?: number; purchased?: boolean; url?: string };

export const people = pgTable(
  'people',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    relationship: text('relationship'),
    birthday: date('birthday'),
    anniversary: date('anniversary'),
    email: text('email'),
    phone: text('phone'),
    notes: text('notes'),
    giftIdeas: jsonb('gift_ideas').notNull().default([]).$type<GiftIdea[]>(),
    customFields: jsonb('custom_fields').notNull().default({}).$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    workspaceIdx: index('idx_people_workspace').on(table.workspaceId),
    birthdayIdx: index('idx_people_birthday').on(table.birthday),
  }),
);

export type Person = typeof people.$inferSelect;
export type NewPerson = typeof people.$inferInsert;
