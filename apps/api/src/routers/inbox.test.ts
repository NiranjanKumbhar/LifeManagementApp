import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@clerk/backend', () => ({
  verifyToken: vi.fn(async (token: string) => ({ sub: token })),
  createClerkClient: () => ({ users: { getUser: vi.fn() } }),
}));

import { createTestDb, type TestDb } from '../__tests__/helpers/db.helper';
import { seedCouple, type SeededCouple } from '../__tests__/helpers/seed.helper';
import { callerFor } from '../__tests__/helpers/auth.helper';
import { insertUser } from '../__tests__/factories/user.factory';
import { createProjectInput } from '../__tests__/factories/project.factory';

let ctx: TestDb;
let world: SeededCouple;

beforeEach(async () => {
  ctx = await createTestDb();
  world = await seedCouple(ctx.db);
});
afterEach(async () => {
  await ctx.close();
});

describe('inboxRouter', () => {
  it('rejects capture from a non-member', async () => {
    const stranger = await insertUser(ctx.db);
    const caller = callerFor(ctx.db, stranger.clerkId);
    await expect(
      caller.inbox.capture({ workspaceId: world.workspace.id, content: 'hi' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('captures and lists an item for a member', async () => {
    const caller = callerFor(ctx.db, world.alex.clerkId);
    const captured = await caller.inbox.capture({
      workspaceId: world.workspace.id,
      content: 'Plan date night',
    });
    const list = await caller.inbox.list({ workspaceId: world.workspace.id });
    expect(list.map((i) => i.id)).toContain(captured.id);
  });

  it('triages an item into a project and drops it from the pending list', async () => {
    const alex = callerFor(ctx.db, world.alex.clerkId);
    const project = await alex.project.create(
      createProjectInput({ workspaceId: world.workspace.id, title: 'Anniversary' }),
    );
    const item = await alex.inbox.capture({
      workspaceId: world.workspace.id,
      content: 'Order cake',
    });

    const task = await alex.inbox.assignToProject({ id: item.id, projectId: project.id });
    expect(task.title).toBe('Order cake');

    const pending = await alex.inbox.list({ workspaceId: world.workspace.id });
    expect(pending.map((i) => i.id)).not.toContain(item.id);
  });

  it('hides a private capture from the partner', async () => {
    const alex = callerFor(ctx.db, world.alex.clerkId);
    const secret = await alex.inbox.capture({
      workspaceId: world.workspace.id,
      content: 'Surprise trip',
      visibility: 'private',
    });

    const jordan = callerFor(ctx.db, world.jordan.clerkId);
    const jordanList = await jordan.inbox.list({ workspaceId: world.workspace.id });
    expect(jordanList.map((i) => i.id)).not.toContain(secret.id);
  });
});
