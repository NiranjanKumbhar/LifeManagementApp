import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { and, eq, isNull } from 'drizzle-orm';

vi.mock('@clerk/backend', () => ({
  verifyToken: vi.fn(async (token: string) => ({ sub: token })),
  createClerkClient: () => ({ users: { getUser: vi.fn(), deleteUser: vi.fn() } }),
}));

import { createTestDb, type TestDb } from '../__tests__/helpers/db.helper';
import { seedCouple, type SeededCouple } from '../__tests__/helpers/seed.helper';
import { callerFor } from '../__tests__/helpers/auth.helper';
import { insertUser } from '../__tests__/factories/user.factory';
import { createProjectInput } from '../__tests__/factories/project.factory';
import { users, workspaces, workspaceMembers, projects } from '../db/schema';
import { AccountService } from './account.service';

let ctx: TestDb;
let world: SeededCouple;

beforeEach(async () => {
  ctx = await createTestDb();
  world = await seedCouple(ctx.db);
});
afterEach(async () => {
  await ctx.close();
});

describe('AccountService.deleteAccount', () => {
  it('deletes a solo workspace and removes the user', async () => {
    const stranger = await insertUser(ctx.db);
    const caller = callerFor(ctx.db, stranger.clerkId);
    const ws = await caller.workspace.create({ name: 'Solo' });
    const project = await caller.project.create(createProjectInput({ workspaceId: ws.id }));

    const res = await AccountService.deleteAccount(ctx.db, stranger.id);
    expect(res.success).toBe(true);

    expect(await ctx.db.select().from(workspaces).where(eq(workspaces.id, ws.id))).toHaveLength(0);
    expect(await ctx.db.select().from(projects).where(eq(projects.id, project.id))).toHaveLength(0);
    expect(await ctx.db.select().from(users).where(eq(users.id, stranger.id))).toHaveLength(0);
  });

  it('keeps a shared workspace, promotes a remaining owner, and nulls attribution', async () => {
    const alex = callerFor(ctx.db, world.alex.clerkId);
    const project = await alex.project.create(
      createProjectInput({ workspaceId: world.workspace.id, title: 'Alex project' }),
    );

    await AccountService.deleteAccount(ctx.db, world.alex.id);

    // Workspace survives; Alex's membership gone; Jordan promoted to owner.
    expect(
      await ctx.db.select().from(workspaces).where(eq(workspaces.id, world.workspace.id)),
    ).toHaveLength(1);
    expect(
      await ctx.db
        .select()
        .from(workspaceMembers)
        .where(
          and(
            eq(workspaceMembers.workspaceId, world.workspace.id),
            eq(workspaceMembers.userId, world.alex.id),
          ),
        ),
    ).toHaveLength(0);
    const jordan = await ctx.db.query.workspaceMembers.findFirst({
      where: and(
        eq(workspaceMembers.workspaceId, world.workspace.id),
        eq(workspaceMembers.userId, world.jordan.id),
      ),
    });
    expect(jordan?.role).toBe('owner');

    // Alex's user row gone; the project survives with created_by nulled (SET NULL).
    expect(await ctx.db.select().from(users).where(eq(users.id, world.alex.id))).toHaveLength(0);
    const survived = await ctx.db
      .select()
      .from(projects)
      .where(and(eq(projects.id, project.id), isNull(projects.createdBy)));
    expect(survived).toHaveLength(1);
  });
});

describe('AccountService.clearData', () => {
  it('removes the solo workspace but keeps the account', async () => {
    const stranger = await insertUser(ctx.db);
    const caller = callerFor(ctx.db, stranger.clerkId);
    const ws = await caller.workspace.create({ name: 'Solo' });

    await AccountService.clearData(ctx.db, stranger.id);

    expect(await ctx.db.select().from(workspaces).where(eq(workspaces.id, ws.id))).toHaveLength(0);
    expect(await ctx.db.select().from(users).where(eq(users.id, stranger.id))).toHaveLength(1);
  });
});
