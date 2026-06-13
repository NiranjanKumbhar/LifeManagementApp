import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@clerk/backend', () => ({
  verifyToken: vi.fn(async (token: string) => ({ sub: token })),
  createClerkClient: () => ({ users: { getUser: vi.fn() } }),
}));

import { createTestDb, type TestDb } from '../__tests__/helpers/db.helper';
import { seedCouple, type SeededCouple } from '../__tests__/helpers/seed.helper';
import { callerFor } from '../__tests__/helpers/auth.helper';
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

describe('taskRouter.reopen', () => {
  it('reopens a completed task: status back to pending and completion cleared', async () => {
    const alex = callerFor(ctx.db, world.alex.clerkId);
    const project = await alex.project.create(
      createProjectInput({ workspaceId: world.workspace.id, title: 'Trip' }),
    );
    const task = await alex.task.create({ projectId: project.id, title: 'Book flights' });

    const completed = await alex.task.complete({ id: task.id });
    expect(completed.status).toBe('completed');
    expect(completed.completedAt).not.toBeNull();

    const reopened = await alex.task.reopen({ id: task.id });
    expect(reopened.status).toBe('pending');
    expect(reopened.completedAt).toBeNull();
    expect(reopened.completedBy).toBeNull();
  });

  it('rejects reopen from a non-member', async () => {
    const alex = callerFor(ctx.db, world.alex.clerkId);
    const project = await alex.project.create(
      createProjectInput({ workspaceId: world.workspace.id, title: 'Trip' }),
    );
    const task = await alex.task.create({ projectId: project.id, title: 'Book flights' });

    const { insertUser } = await import('../__tests__/factories/user.factory');
    const stranger = await insertUser(ctx.db);
    const strangerCaller = callerFor(ctx.db, stranger.clerkId);
    await expect(strangerCaller.task.reopen({ id: task.id })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});
