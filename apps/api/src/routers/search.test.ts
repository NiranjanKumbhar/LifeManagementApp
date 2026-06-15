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
import { createHouseholdInput } from '../__tests__/factories/household.factory';

let ctx: TestDb;
let world: SeededCouple;

beforeEach(async () => {
  ctx = await createTestDb();
  world = await seedCouple(ctx.db);
});
afterEach(async () => {
  await ctx.close();
});

describe('searchRouter — authorization', () => {
  it('rejects unauthenticated callers', async () => {
    const caller = callerFor(ctx.db, null);
    await expect(
      caller.search.query({ workspaceId: world.workspace.id, query: 'anything' }),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('rejects a non-member querying the workspace', async () => {
    const stranger = await insertUser(ctx.db);
    const caller = callerFor(ctx.db, stranger.clerkId);
    await expect(
      caller.search.query({ workspaceId: world.workspace.id, query: 'anything' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('searchRouter — cross-entity search', () => {
  it('returns matching projects', async () => {
    const alex = callerFor(ctx.db, world.alex.clerkId);
    await alex.project.create(
      createProjectInput({ workspaceId: world.workspace.id, title: 'Annual budget review' }),
    );
    const results = await alex.search.query({ workspaceId: world.workspace.id, query: 'budget' });
    const projectHits = results.filter((r) => r.type === 'project');
    expect(projectHits.length).toBeGreaterThan(0);
    expect(projectHits[0].highlights[0]).toMatch(/budget/i);
  });

  it('returns matching tasks', async () => {
    const alex = callerFor(ctx.db, world.alex.clerkId);
    const project = await alex.project.create(
      createProjectInput({ workspaceId: world.workspace.id }),
    );
    await alex.task.create({ projectId: project.id, title: 'Schedule dentist appointment' });
    const results = await alex.search.query({ workspaceId: world.workspace.id, query: 'dentist' });
    const taskHits = results.filter((r) => r.type === 'task');
    expect(taskHits.length).toBeGreaterThan(0);
  });

  it('returns matching people', async () => {
    const alex = callerFor(ctx.db, world.alex.clerkId);
    await alex.person.create({ workspaceId: world.workspace.id, name: 'Bartholomew Smith' });
    const results = await alex.search.query({
      workspaceId: world.workspace.id,
      query: 'Bartholomew',
    });
    const personHits = results.filter((r) => r.type === 'person');
    expect(personHits.length).toBeGreaterThan(0);
  });

  it('returns matching household items', async () => {
    const alex = callerFor(ctx.db, world.alex.clerkId);
    await alex.household.add(
      createHouseholdInput({ workspaceId: world.workspace.id, name: 'Kombucha tea' }),
    );
    const results = await alex.search.query({ workspaceId: world.workspace.id, query: 'kombucha' });
    const householdHits = results.filter((r) => r.type === 'household_item');
    expect(householdHits.length).toBeGreaterThan(0);
  });

  it('returns empty when nothing matches', async () => {
    const alex = callerFor(ctx.db, world.alex.clerkId);
    const results = await alex.search.query({
      workspaceId: world.workspace.id,
      query: 'zxqwerty_no_match_xyz',
    });
    expect(results).toHaveLength(0);
  });
});

describe('searchRouter — type filter', () => {
  it('limits results to the specified type', async () => {
    const alex = callerFor(ctx.db, world.alex.clerkId);
    await alex.project.create(
      createProjectInput({ workspaceId: world.workspace.id, title: 'uniqueterm project' }),
    );
    await alex.person.create({ workspaceId: world.workspace.id, name: 'uniqueterm person' });

    const projectOnly = await alex.search.query({
      workspaceId: world.workspace.id,
      query: 'uniqueterm',
      type: 'project',
    });
    expect(projectOnly.every((r) => r.type === 'project')).toBe(true);
  });
});

describe('searchRouter — visibility filtering', () => {
  it("excludes a partner's private project from search results", async () => {
    const alex = callerFor(ctx.db, world.alex.clerkId);
    await alex.project.create(
      createProjectInput({
        workspaceId: world.workspace.id,
        title: 'supersecretproject_xyz',
        visibility: 'private',
      }),
    );

    const jordan = callerFor(ctx.db, world.jordan.clerkId);
    const results = await jordan.search.query({
      workspaceId: world.workspace.id,
      query: 'supersecretproject_xyz',
    });
    expect(results.filter((r) => r.type === 'project')).toHaveLength(0);
  });

  it('returns a private project to its owner', async () => {
    const alex = callerFor(ctx.db, world.alex.clerkId);
    await alex.project.create(
      createProjectInput({
        workspaceId: world.workspace.id,
        title: 'myprivateproject_xyz',
        visibility: 'private',
      }),
    );

    const results = await alex.search.query({
      workspaceId: world.workspace.id,
      query: 'myprivateproject_xyz',
    });
    expect(results.filter((r) => r.type === 'project')).toHaveLength(1);
  });
});
