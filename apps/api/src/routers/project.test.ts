import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock Clerk at the boundary: the auth token IS treated as the user's clerkId,
// so `verifyToken(token)` resolves to `{ sub: token }`. Hoisted above imports.
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

describe('projectRouter — authorization', () => {
  it('rejects unauthenticated requests', async () => {
    const caller = callerFor(ctx.db, null);
    await expect(caller.project.list({ workspaceId: world.workspace.id })).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });

  it('rejects a user who is not a member of the workspace', async () => {
    const stranger = await insertUser(ctx.db);
    const caller = callerFor(ctx.db, stranger.clerkId);
    await expect(caller.project.list({ workspaceId: world.workspace.id })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('rejects project creation by a non-member', async () => {
    const stranger = await insertUser(ctx.db);
    const caller = callerFor(ctx.db, stranger.clerkId);
    await expect(
      caller.project.create(createProjectInput({ workspaceId: world.workspace.id })),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('projectRouter — member flows', () => {
  it('creates and then lists a project for a member', async () => {
    const caller = callerFor(ctx.db, world.alex.clerkId);
    const created = await caller.project.create(
      createProjectInput({ workspaceId: world.workspace.id, title: 'Plan the move' }),
    );
    const list = await caller.project.list({ workspaceId: world.workspace.id });
    expect(list.map((p) => p.id)).toContain(created.id);
  });

  it('hides a private project from the partner end-to-end', async () => {
    const alex = callerFor(ctx.db, world.alex.clerkId);
    const secret = await alex.project.create(
      createProjectInput({
        workspaceId: world.workspace.id,
        title: 'Surprise gift',
        visibility: 'private',
      }),
    );

    const jordan = callerFor(ctx.db, world.jordan.clerkId);
    const jordanList = await jordan.project.list({ workspaceId: world.workspace.id });
    expect(jordanList.map((p) => p.id)).not.toContain(secret.id);

    // Direct fetch must also be hidden.
    await expect(jordan.project.get({ id: secret.id })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('returns task counts on list rows', async () => {
    const caller = callerFor(ctx.db, world.alex.clerkId);
    const project = await caller.project.create(
      createProjectInput({ workspaceId: world.workspace.id, title: 'Counts' }),
    );
    const a = await caller.task.create({ projectId: project.id, title: 'A' });
    await caller.task.create({ projectId: project.id, title: 'B' });
    await caller.task.complete({ id: a.id });

    const list = await caller.project.list({ workspaceId: world.workspace.id });
    const row = list.find((p) => p.id === project.id);
    expect(row).toBeDefined();
    expect(row).toMatchObject({ taskCount: 2, completedCount: 1 });
  });

  it('returns zero task counts for a project with no tasks', async () => {
    const caller = callerFor(ctx.db, world.alex.clerkId);
    const empty = await caller.project.create(
      createProjectInput({ workspaceId: world.workspace.id, title: 'Empty' }),
    );

    const list = await caller.project.list({ workspaceId: world.workspace.id });
    const row = list.find((p) => p.id === empty.id);
    expect(row).toBeDefined();
    expect(row).toMatchObject({ taskCount: 0, completedCount: 0 });
  });
});
