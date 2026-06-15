import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@clerk/backend', () => ({
  verifyToken: vi.fn(async (token: string) => ({ sub: token })),
  createClerkClient: () => ({ users: { getUser: vi.fn() } }),
}));

import { createTestDb, type TestDb } from '../__tests__/helpers/db.helper';
import { seedCouple, type SeededCouple } from '../__tests__/helpers/seed.helper';
import { callerFor } from '../__tests__/helpers/auth.helper';
import { insertUser } from '../__tests__/factories/user.factory';

let ctx: TestDb;
let world: SeededCouple;

beforeEach(async () => {
  ctx = await createTestDb();
  world = await seedCouple(ctx.db);
});
afterEach(async () => {
  await ctx.close();
});

describe('workspaceRouter — get', () => {
  it('rejects unauthenticated callers', async () => {
    const caller = callerFor(ctx.db, null);
    await expect(caller.workspace.get({ id: world.workspace.id })).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });

  it('returns the workspace for a member', async () => {
    const alex = callerFor(ctx.db, world.alex.clerkId);
    const ws = await alex.workspace.get({ id: world.workspace.id });
    expect(ws.id).toBe(world.workspace.id);
  });

  it('hides the workspace from a non-member (NOT_FOUND)', async () => {
    const stranger = await insertUser(ctx.db);
    const caller = callerFor(ctx.db, stranger.clerkId);
    await expect(caller.workspace.get({ id: world.workspace.id })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});

describe('workspaceRouter — create', () => {
  it('creates a workspace and enrolls the creator as owner', async () => {
    const stranger = await insertUser(ctx.db);
    const caller = callerFor(ctx.db, stranger.clerkId);
    const ws = await caller.workspace.create({ name: 'Beach House' });
    expect(ws.name).toBe('Beach House');

    // The creator is now a member and can read it + appears as owner.
    const fetched = await caller.workspace.get({ id: ws.id });
    expect(fetched.id).toBe(ws.id);
    const members = await caller.workspace.members({ workspaceId: ws.id });
    expect(members).toHaveLength(1);
    expect(members[0]).toMatchObject({ userId: stranger.id, role: 'owner' });
  });
});

describe('workspaceRouter — members', () => {
  it('lists both partners with their user details', async () => {
    const alex = callerFor(ctx.db, world.alex.clerkId);
    const members = await alex.workspace.members({ workspaceId: world.workspace.id });
    expect(members).toHaveLength(2);

    const byRole = Object.fromEntries(members.map((m) => [m.role, m]));
    expect(byRole.owner.user).toMatchObject({ id: world.alex.id, displayName: 'Alex' });
    expect(byRole.member.user).toMatchObject({ id: world.jordan.id, displayName: 'Jordan' });
  });

  it('rejects a non-member listing members', async () => {
    const stranger = await insertUser(ctx.db);
    const caller = callerFor(ctx.db, stranger.clerkId);
    await expect(
      caller.workspace.members({ workspaceId: world.workspace.id }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('workspaceRouter — invite', () => {
  it('is not implemented yet (delegated to Clerk Organizations)', async () => {
    const alex = callerFor(ctx.db, world.alex.clerkId);
    await expect(
      alex.workspace.invite({ workspaceId: world.workspace.id, email: 'new@example.com' }),
    ).rejects.toMatchObject({ code: 'NOT_IMPLEMENTED' });
  });
});
