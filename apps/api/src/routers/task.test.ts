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

describe('taskRouter — list', () => {
  it('lists tasks for a project the caller can read', async () => {
    const alex = callerFor(ctx.db, world.alex.clerkId);
    const project = await alex.project.create(
      createProjectInput({ workspaceId: world.workspace.id, title: 'Read project' }),
    );
    await alex.task.create({ projectId: project.id, title: 'Task A' });
    await alex.task.create({ projectId: project.id, title: 'Task B' });

    const list = await alex.task.list({ projectId: project.id });
    expect(list.map((t) => t.title).sort()).toEqual(['Task A', 'Task B']);
  });

  it('populates createdByUser on listed tasks and leaves completedByUser null', async () => {
    const alex = callerFor(ctx.db, world.alex.clerkId);
    const project = await alex.project.create(
      createProjectInput({ workspaceId: world.workspace.id }),
    );
    await alex.task.create({ projectId: project.id, title: 'Owned task' });

    const [task] = await alex.task.list({ projectId: project.id });
    expect(task.createdByUser).not.toBeNull();
    expect(typeof task.createdByUser?.displayName).toBe('string');
    expect(task.completedByUser).toBeNull();
  });

  it('returns an empty list for a project with no tasks', async () => {
    const alex = callerFor(ctx.db, world.alex.clerkId);
    const project = await alex.project.create(
      createProjectInput({ workspaceId: world.workspace.id }),
    );
    const list = await alex.task.list({ projectId: project.id });
    expect(list).toHaveLength(0);
  });

  it('hides a private project from the partner', async () => {
    const alex = callerFor(ctx.db, world.alex.clerkId);
    const secret = await alex.project.create(
      createProjectInput({ workspaceId: world.workspace.id, visibility: 'private' }),
    );
    await alex.task.create({ projectId: secret.id, title: 'Secret task' });

    const jordan = callerFor(ctx.db, world.jordan.clerkId);
    await expect(jordan.task.list({ projectId: secret.id })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});

describe('taskRouter — create', () => {
  it('creates a task with default priority medium', async () => {
    const alex = callerFor(ctx.db, world.alex.clerkId);
    const project = await alex.project.create(
      createProjectInput({ workspaceId: world.workspace.id }),
    );
    const task = await alex.task.create({ projectId: project.id, title: 'Buy milk' });
    expect(task.title).toBe('Buy milk');
    expect(task.priority).toBe('medium');
    expect(task.status).toBe('pending');
  });

  it('creates a child task nested under a parent', async () => {
    const alex = callerFor(ctx.db, world.alex.clerkId);
    const project = await alex.project.create(
      createProjectInput({ workspaceId: world.workspace.id }),
    );
    const parent = await alex.task.create({ projectId: project.id, title: 'Parent' });
    const child = await alex.task.create({ projectId: project.id, title: 'Child', parentId: parent.id });

    expect(child.parentId).toBe(parent.id);
    // Path materializes as the parent id
    expect(child.path).toBe(parent.id);

    // The list returns a tree with child nested under parent
    const tree = await alex.task.list({ projectId: project.id });
    const parentNode = tree.find((t) => t.id === parent.id);
    expect(parentNode?.children.map((c) => c.id)).toContain(child.id);
  });

  it('rejects creating a task by a non-member', async () => {
    const alex = callerFor(ctx.db, world.alex.clerkId);
    const project = await alex.project.create(
      createProjectInput({ workspaceId: world.workspace.id }),
    );
    const stranger = await insertUser(ctx.db);
    const strangerCaller = callerFor(ctx.db, stranger.clerkId);
    await expect(
      strangerCaller.task.create({ projectId: project.id, title: 'Hijack' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('taskRouter — update', () => {
  it('updates task title and priority', async () => {
    const alex = callerFor(ctx.db, world.alex.clerkId);
    const project = await alex.project.create(
      createProjectInput({ workspaceId: world.workspace.id }),
    );
    const task = await alex.task.create({ projectId: project.id, title: 'Old title' });
    const updated = await alex.task.update({ id: task.id, title: 'New title', priority: 'urgent' });
    expect(updated.title).toBe('New title');
    expect(updated.priority).toBe('urgent');
  });

  it('partner can update a task in a shared project', async () => {
    const alex = callerFor(ctx.db, world.alex.clerkId);
    const project = await alex.project.create(
      createProjectInput({ workspaceId: world.workspace.id, visibility: 'shared' }),
    );
    const task = await alex.task.create({ projectId: project.id, title: 'Shared task' });

    const jordan = callerFor(ctx.db, world.jordan.clerkId);
    const updated = await jordan.task.update({ id: task.id, title: 'Updated by Jordan' });
    expect(updated.title).toBe('Updated by Jordan');
  });

  it('no-op update returns the existing task unchanged', async () => {
    const alex = callerFor(ctx.db, world.alex.clerkId);
    const project = await alex.project.create(
      createProjectInput({ workspaceId: world.workspace.id }),
    );
    const task = await alex.task.create({ projectId: project.id, title: 'Same' });
    const returned = await alex.task.update({ id: task.id });
    expect(returned.id).toBe(task.id);
    expect(returned.title).toBe('Same');
  });
});

describe('taskRouter — complete', () => {
  it('marks a task completed with a timestamp', async () => {
    const alex = callerFor(ctx.db, world.alex.clerkId);
    const project = await alex.project.create(
      createProjectInput({ workspaceId: world.workspace.id }),
    );
    const task = await alex.task.create({ projectId: project.id, title: 'Finish me' });
    const done = await alex.task.complete({ id: task.id });
    expect(done.status).toBe('completed');
    expect(done.completedAt).not.toBeNull();
    expect(done.completedBy).toBe(world.alex.id);
  });
});

describe('taskRouter — reopen', () => {
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

describe('taskRouter — reorder', () => {
  it('changes the sort order of a task', async () => {
    const alex = callerFor(ctx.db, world.alex.clerkId);
    const project = await alex.project.create(
      createProjectInput({ workspaceId: world.workspace.id }),
    );
    const task = await alex.task.create({ projectId: project.id, title: 'Reorder me', sortOrder: 0 });
    await alex.task.reorder({ projectId: project.id, taskId: task.id, newOrder: 5 });
    const list = await alex.task.list({ projectId: project.id });
    const reordered = list.find((t) => t.id === task.id);
    expect(reordered?.sortOrder).toBe(5);
  });
});

describe('taskRouter — move', () => {
  it('moves a task to a different project', async () => {
    const alex = callerFor(ctx.db, world.alex.clerkId);
    const src = await alex.project.create(
      createProjectInput({ workspaceId: world.workspace.id, title: 'Source' }),
    );
    const dest = await alex.project.create(
      createProjectInput({ workspaceId: world.workspace.id, title: 'Destination' }),
    );
    const task = await alex.task.create({ projectId: src.id, title: 'Move me' });
    const moved = await alex.task.move({ taskId: task.id, newProjectId: dest.id });
    expect(moved.projectId).toBe(dest.id);
    expect(moved.parentId).toBeNull();

    // No longer in source
    const srcTasks = await alex.task.list({ projectId: src.id });
    expect(srcTasks.map((t) => t.id)).not.toContain(task.id);

    // Now in destination
    const destTasks = await alex.task.list({ projectId: dest.id });
    expect(destTasks.map((t) => t.id)).toContain(task.id);
  });
});

describe('taskRouter — task privacy', () => {
  it('hides a private task (and its subtree) from non-creators', async () => {
    const alex = callerFor(ctx.db, world.alex.clerkId);
    const jordan = callerFor(ctx.db, world.jordan.clerkId);
    const project = await alex.project.create(
      createProjectInput({ workspaceId: world.workspace.id, title: 'Shared proj' }),
    );
    const secret = await alex.task.create({ projectId: project.id, title: 'Secret', visibility: 'private' });
    await alex.task.create({ projectId: project.id, parentId: secret.id, title: 'Secret child' });
    await alex.task.create({ projectId: project.id, title: 'Open task' });

    const titles = (nodes: Array<{ title: string; children: unknown[] }>): string[] =>
      nodes.flatMap((n) => [n.title, ...titles(n.children as Array<{ title: string; children: unknown[] }>)]);

    const alexList = await alex.task.list({ projectId: project.id });
    const jordanList = await jordan.task.list({ projectId: project.id });
    expect(titles(alexList)).toEqual(expect.arrayContaining(['Secret', 'Secret child', 'Open task']));
    expect(titles(jordanList)).toContain('Open task');
    expect(titles(jordanList)).not.toContain('Secret');
    expect(titles(jordanList)).not.toContain('Secret child');
  });

  it('also hides the private task from project.get for a non-creator', async () => {
    const alex = callerFor(ctx.db, world.alex.clerkId);
    const jordan = callerFor(ctx.db, world.jordan.clerkId);
    const project = await alex.project.create(createProjectInput({ workspaceId: world.workspace.id }));
    await alex.task.create({ projectId: project.id, title: 'Secret', visibility: 'private' });
    const got = await jordan.project.get({ id: project.id });
    expect(got.tasks.map((t) => t.title)).not.toContain('Secret');
  });

  it('forbids a non-creator from editing a private task (NOT_FOUND)', async () => {
    const alex = callerFor(ctx.db, world.alex.clerkId);
    const jordan = callerFor(ctx.db, world.jordan.clerkId);
    const project = await alex.project.create(createProjectInput({ workspaceId: world.workspace.id }));
    const secret = await alex.task.create({ projectId: project.id, title: 'Secret', visibility: 'private' });
    await expect(jordan.task.update({ id: secret.id, title: 'hax' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
