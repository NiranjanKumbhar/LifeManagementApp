import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@clerk/backend', () => ({
  verifyToken: vi.fn(async (token: string) => ({ sub: token })),
  createClerkClient: () => ({ users: { getUser: vi.fn() } }),
}));

import { createTestDb, type TestDb } from '../__tests__/helpers/db.helper';
import { seedCouple, type SeededCouple } from '../__tests__/helpers/seed.helper';
import { callerFor } from '../__tests__/helpers/auth.helper';
import { addMember, insertUser } from '../__tests__/factories/user.factory';

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

describe('workspaceRouter — mine', () => {
  it('returns the workspaces the user belongs to with their role', async () => {
    const alex = callerFor(ctx.db, world.alex.clerkId);
    const mine = await alex.workspace.mine();
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ workspace: { id: world.workspace.id }, role: 'owner' });
  });

  it('returns empty for a user in no workspace', async () => {
    const stranger = await insertUser(ctx.db);
    const caller = callerFor(ctx.db, stranger.clerkId);
    expect(await caller.workspace.mine()).toEqual([]);
  });
});

describe('workspaceRouter — invites', () => {
  it('owner can create an invite and a member cannot', async () => {
    const alex = callerFor(ctx.db, world.alex.clerkId);
    const jordan = callerFor(ctx.db, world.jordan.clerkId);
    const res = await alex.workspace.createInvite({ workspaceId: world.workspace.id });
    expect(res.joinPath).toMatch(/^\/join\//);
    expect(res.invite.status).toBe('pending');
    await expect(
      jordan.workspace.createInvite({ workspaceId: world.workspace.id }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('a signed-in stranger can accept an invite and becomes a member', async () => {
    const alex = callerFor(ctx.db, world.alex.clerkId);
    const { invite } = await alex.workspace.createInvite({ workspaceId: world.workspace.id });
    const stranger = await insertUser(ctx.db);
    const ws = await callerFor(ctx.db, stranger.clerkId).workspace.acceptInvite({
      token: invite.token,
    });
    expect(ws.id).toBe(world.workspace.id);
    const members = await alex.workspace.members({ workspaceId: world.workspace.id });
    expect(members.map((m) => m.userId)).toContain(stranger.id);
  });

  it('rejects a revoked invite', async () => {
    const alex = callerFor(ctx.db, world.alex.clerkId);
    const { invite } = await alex.workspace.createInvite({ workspaceId: world.workspace.id });
    await alex.workspace.revokeInvite({ id: invite.id });
    const stranger = await insertUser(ctx.db);
    await expect(
      callerFor(ctx.db, stranger.clerkId).workspace.acceptInvite({ token: invite.token }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('rejects accept when the workspace is full (6 members)', async () => {
    const alex = callerFor(ctx.db, world.alex.clerkId);
    for (let i = 0; i < 4; i++) {
      const u = await insertUser(ctx.db);
      const { invite } = await alex.workspace.createInvite({ workspaceId: world.workspace.id });
      await callerFor(ctx.db, u.clerkId).workspace.acceptInvite({ token: invite.token });
    }
    const seventh = await insertUser(ctx.db);
    const { invite } = await alex.workspace.createInvite({ workspaceId: world.workspace.id });
    await expect(
      callerFor(ctx.db, seventh.clerkId).workspace.acceptInvite({ token: invite.token }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('previews an invite without joining', async () => {
    const alex = callerFor(ctx.db, world.alex.clerkId);
    const { invite } = await alex.workspace.createInvite({ workspaceId: world.workspace.id });
    const stranger = await insertUser(ctx.db);
    const preview = await callerFor(ctx.db, stranger.clerkId).workspace.invitePreview({
      token: invite.token,
    });
    expect(preview).toMatchObject({ workspaceName: world.workspace.name, status: 'pending' });
  });

  it('lists pending invites for the owner', async () => {
    const alex = callerFor(ctx.db, world.alex.clerkId);
    await alex.workspace.createInvite({ workspaceId: world.workspace.id });
    const list = await alex.workspace.listInvites({ workspaceId: world.workspace.id });
    expect(list.length).toBeGreaterThanOrEqual(1);
    expect(list.every((i) => i.status === 'pending')).toBe(true);
  });

  it('rejects reusing an already-accepted invite (single-use)', async () => {
    const alex = callerFor(ctx.db, world.alex.clerkId);
    const { invite } = await alex.workspace.createInvite({ workspaceId: world.workspace.id });
    const first = await insertUser(ctx.db);
    await callerFor(ctx.db, first.clerkId).workspace.acceptInvite({ token: invite.token });

    const second = await insertUser(ctx.db);
    await expect(
      callerFor(ctx.db, second.clerkId).workspace.acceptInvite({ token: invite.token }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('workspaceRouter — role & membership management', () => {
  it('owner promotes a member to owner; member cannot change roles', async () => {
    const alex = callerFor(ctx.db, world.alex.clerkId);
    const stranger = await insertUser(ctx.db);
    await addMember(ctx.db, world.workspace.id, stranger.id, 'member');
    const updated = await alex.workspace.changeRole({
      workspaceId: world.workspace.id, targetUserId: world.jordan.id, role: 'owner',
    });
    expect(updated.role).toBe('owner');
    await expect(
      callerFor(ctx.db, stranger.clerkId).workspace.changeRole({
        workspaceId: world.workspace.id, targetUserId: world.alex.id, role: 'member',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('blocks demoting the last owner', async () => {
    const alex = callerFor(ctx.db, world.alex.clerkId);
    await expect(
      alex.workspace.changeRole({ workspaceId: world.workspace.id, targetUserId: world.alex.id, role: 'member' }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('owner removes a member; blocks removing the last owner', async () => {
    const alex = callerFor(ctx.db, world.alex.clerkId);
    await alex.workspace.removeMember({ workspaceId: world.workspace.id, targetUserId: world.jordan.id });
    const members = await alex.workspace.members({ workspaceId: world.workspace.id });
    expect(members.map((m) => m.userId)).not.toContain(world.jordan.id);
    await expect(
      alex.workspace.removeMember({ workspaceId: world.workspace.id, targetUserId: world.alex.id }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('a member can leave; the last owner cannot', async () => {
    const jordan = callerFor(ctx.db, world.jordan.clerkId);
    await jordan.workspace.leave({ workspaceId: world.workspace.id });
    expect(await jordan.workspace.mine()).toEqual([]);
    const alex = callerFor(ctx.db, world.alex.clerkId);
    await expect(
      alex.workspace.leave({ workspaceId: world.workspace.id }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('a non-last owner can leave', async () => {
    const alex = callerFor(ctx.db, world.alex.clerkId);
    await alex.workspace.changeRole({ workspaceId: world.workspace.id, targetUserId: world.jordan.id, role: 'owner' });
    await alex.workspace.leave({ workspaceId: world.workspace.id });
    const jordan = callerFor(ctx.db, world.jordan.clerkId);
    const members = await jordan.workspace.members({ workspaceId: world.workspace.id });
    expect(members.map((m) => m.userId)).not.toContain(world.alex.id);
  });
});
