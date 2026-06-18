import { pgTable, uuid, text, timestamp, index, unique } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users';

export const workspaces = pgTable('workspaces', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const workspaceMembers = pgTable(
  'workspace_members',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text('role').notNull().default('member').$type<'owner' | 'member'>(),
    invitedAt: timestamp('invited_at', { withTimezone: true }).notNull().defaultNow(),
    joinedAt: timestamp('joined_at', { withTimezone: true }),
  },
  (table) => ({
    uniqueMember: unique('workspace_members_unique').on(table.workspaceId, table.userId),
    workspaceIdx: index('idx_workspace_members_workspace').on(table.workspaceId),
    userIdx: index('idx_workspace_members_user').on(table.userId),
  }),
);

export type Workspace = typeof workspaces.$inferSelect;
export type NewWorkspace = typeof workspaces.$inferInsert;
export type WorkspaceMember = typeof workspaceMembers.$inferSelect;
export type NewWorkspaceMember = typeof workspaceMembers.$inferInsert;

export const workspaceInvites = pgTable(
  'workspace_invites',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    token: text('token').notNull().unique(),
    email: text('email'),
    role: text('role').notNull().default('member').$type<'owner' | 'member'>(),
    status: text('status')
      .notNull()
      .default('pending')
      .$type<'pending' | 'accepted' | 'revoked' | 'expired'>(),
    invitedBy: uuid('invited_by')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    acceptedBy: uuid('accepted_by').references(() => users.id, { onDelete: 'set null' }),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    workspaceIdx: index('idx_workspace_invites_workspace').on(table.workspaceId),
  }),
);

export type WorkspaceInvite = typeof workspaceInvites.$inferSelect;
export type NewWorkspaceInvite = typeof workspaceInvites.$inferInsert;
