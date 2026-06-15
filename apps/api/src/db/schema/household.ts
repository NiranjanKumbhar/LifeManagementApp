import { pgTable, uuid, text, timestamp, boolean, integer, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { workspaces } from './workspaces';
import { users } from './users';

export type StockStatus = 'stocked' | 'low' | 'out' | 'on_list';

export const householdItems = pgTable(
  'household_items',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    category: text('category').notNull().default('other'),
    status: text('status').notNull().default('stocked').$type<StockStatus>(),
    quantity: integer('quantity'),
    unit: text('unit'),
    autoReplenish: boolean('auto_replenish').notNull().default(false),
    lastPurchased: timestamp('last_purchased', { withTimezone: true }),
    addedBy: uuid('added_by').references(() => users.id),
    lastPurchasedBy: uuid('last_purchased_by').references(() => users.id),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    workspaceCategoryIdx: index('idx_household_workspace').on(
      table.workspaceId,
      table.category,
    ),
    statusIdx: index('idx_household_status').on(table.workspaceId, table.status),
  }),
);

export type HouseholdItem = typeof householdItems.$inferSelect;
export type NewHouseholdItem = typeof householdItems.$inferInsert;
