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

describe('activityRouter — authorization', () => {
  it('rejects unauthenticated callers', async () => {
    const caller = callerFor(ctx.db, null);
    await expect(caller.activity.feed({ workspaceId: world.workspace.id })).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });

  it('rejects a non-member reading the activity feed', async () => {
    const stranger = await insertUser(ctx.db);
    const caller = callerFor(ctx.db, stranger.clerkId);
    await expect(caller.activity.feed({ workspaceId: world.workspace.id })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });
});

describe('activityRouter — feed', () => {
  it('returns activity events newest-first', async () => {
    const alex = callerFor(ctx.db, world.alex.clerkId);
    // Creating a project produces a "created" activity event.
    await alex.project.create(
      createProjectInput({ workspaceId: world.workspace.id, title: 'First project' }),
    );
    await alex.project.create(
      createProjectInput({ workspaceId: world.workspace.id, title: 'Second project' }),
    );

    const page = await alex.activity.feed({ workspaceId: world.workspace.id });
    expect(page.items.length).toBeGreaterThanOrEqual(2);
    // Newest is first: createdAt descending
    const timestamps = page.items.map((e) => new Date(e.createdAt).getTime());
    for (let i = 1; i < timestamps.length; i++) {
      expect(timestamps[i - 1]).toBeGreaterThanOrEqual(timestamps[i]);
    }
  });

  it("hides a private project's activity events from the partner", async () => {
    const alex = callerFor(ctx.db, world.alex.clerkId);
    const secret = await alex.project.create(
      createProjectInput({
        workspaceId: world.workspace.id,
        title: 'SurpriseParty_unique',
        visibility: 'private',
      }),
    );

    const jordan = callerFor(ctx.db, world.jordan.clerkId);
    const page = await jordan.activity.feed({ workspaceId: world.workspace.id });
    const secretEvents = page.items.filter((e) => e.entityId === secret.id);
    expect(secretEvents).toHaveLength(0);
  });

  it('shows the private project activity to the owner', async () => {
    const alex = callerFor(ctx.db, world.alex.clerkId);
    const secret = await alex.project.create(
      createProjectInput({
        workspaceId: world.workspace.id,
        title: 'MyPrivatePlan_unique',
        visibility: 'private',
      }),
    );

    const page = await alex.activity.feed({ workspaceId: world.workspace.id });
    const myEvent = page.items.find((e) => e.entityId === secret.id);
    expect(myEvent).toBeDefined();
  });

  it('paginates with limit', async () => {
    const alex = callerFor(ctx.db, world.alex.clerkId);
    // Create 5 projects → 5 activity events
    for (let i = 0; i < 5; i++) {
      await alex.project.create(createProjectInput({ workspaceId: world.workspace.id }));
    }
    const page = await alex.activity.feed({ workspaceId: world.workspace.id, limit: 3 });
    expect(page.items).toHaveLength(3);
    expect(page.hasMore).toBe(true);
    expect(page.nextCursor).not.toBeNull();
  });

  it('cursor resumes from where it left off', async () => {
    const alex = callerFor(ctx.db, world.alex.clerkId);
    for (let i = 0; i < 4; i++) {
      await alex.project.create(createProjectInput({ workspaceId: world.workspace.id }));
    }
    const first = await alex.activity.feed({ workspaceId: world.workspace.id, limit: 2 });
    expect(first.hasMore).toBe(true);

    const second = await alex.activity.feed({
      workspaceId: world.workspace.id,
      limit: 2,
      cursor: first.nextCursor!,
    });
    const firstIds = new Set(first.items.map((e) => e.id));
    expect(second.items.every((e) => !firstIds.has(e.id))).toBe(true);
  });
});
