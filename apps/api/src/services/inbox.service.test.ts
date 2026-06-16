import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { InboxService } from './inbox.service';
import { activityEvents, inboxItems, tasks } from '../db/schema';
import type { AppError, AppErrorCode, Result } from '../utils/errors';
import { createTestDb, type TestDb } from '../__tests__/helpers/db.helper';
import { seedCouple, type SeededCouple } from '../__tests__/helpers/seed.helper';
import { insertProject } from '../__tests__/factories/project.factory';
import { insertInboxItem } from '../__tests__/factories/inbox.factory';

function expectOk<T>(res: Result<T, AppError>): T {
  if (!res.success) throw new Error(`expected ok, got ${res.error.code}: ${res.error.message}`);
  return res.data;
}
function expectErr<T>(res: Result<T, AppError>, code: AppErrorCode): void {
  if (res.success) throw new Error(`expected error ${code}, got ok`);
  expect(res.error.code).toBe(code);
}

let ctx: TestDb;
let world: SeededCouple;

beforeEach(async () => {
  ctx = await createTestDb();
  world = await seedCouple(ctx.db);
});
afterEach(async () => {
  await ctx.close();
});

describe('InboxService.capture', () => {
  it('captures a pending item owned by the capturer and logs it', async () => {
    const item = expectOk(
      await InboxService.capture(ctx.db, world.alex.id, {
        workspaceId: world.workspace.id,
        content: 'Buy flowers for mum',
      }),
    );
    expect(item.content).toBe('Buy flowers for mum');
    expect(item.status).toBe('pending');
    expect(item.capturedBy).toBe(world.alex.id);
    expect(item.ownerId).toBe(world.alex.id);

    const events = await ctx.db
      .select()
      .from(activityEvents)
      .where(eq(activityEvents.entityId, item.id));
    expect(events[0]).toMatchObject({ action: 'created', entityType: 'inbox_item' });
  });

  it('respects an explicit private visibility', async () => {
    const item = expectOk(
      await InboxService.capture(ctx.db, world.alex.id, {
        workspaceId: world.workspace.id,
        content: 'Secret gift idea',
        visibility: 'private',
      }),
    );
    expect(item.visibility).toBe('private');
  });
});

describe('InboxService.list', () => {
  it('returns pending items but never a private one belonging to the partner', async () => {
    await insertInboxItem(ctx.db, {
      workspaceId: world.workspace.id,
      capturedBy: world.alex.id,
      ownerId: world.alex.id,
      content: 'Shared note',
      visibility: 'shared',
    });
    await insertInboxItem(ctx.db, {
      workspaceId: world.workspace.id,
      capturedBy: world.alex.id,
      ownerId: world.alex.id,
      content: 'Private note',
      visibility: 'private',
    });

    const asPartner = expectOk(
      await InboxService.list(ctx.db, world.jordan.id, { workspaceId: world.workspace.id }),
    );
    expect(asPartner.map((i) => i.content)).toEqual(['Shared note']);

    const asOwner = expectOk(
      await InboxService.list(ctx.db, world.alex.id, { workspaceId: world.workspace.id }),
    );
    expect(asOwner).toHaveLength(2);
  });

  it('enriches items with the capturing user', async () => {
    await insertInboxItem(ctx.db, {
      workspaceId: world.workspace.id,
      capturedBy: world.alex.id,
      ownerId: world.alex.id,
      content: 'Shared note',
      visibility: 'shared',
    });

    const items = expectOk(
      await InboxService.list(ctx.db, world.alex.id, { workspaceId: world.workspace.id }),
    );
    expect(items[0]!.capturedByUser).toMatchObject({ id: world.alex.id });
  });

  it('excludes triaged items by default', async () => {
    await insertInboxItem(ctx.db, {
      workspaceId: world.workspace.id,
      capturedBy: world.alex.id,
      ownerId: world.alex.id,
      status: 'triaged',
    });
    const pending = expectOk(
      await InboxService.list(ctx.db, world.alex.id, { workspaceId: world.workspace.id }),
    );
    expect(pending).toHaveLength(0);
  });
});

describe('InboxService.assignToProject', () => {
  it('creates a task from the item and marks it triaged', async () => {
    const project = await insertProject(ctx.db, {
      workspaceId: world.workspace.id,
      ownerId: world.alex.id,
      visibility: 'shared',
    });
    const item = await insertInboxItem(ctx.db, {
      workspaceId: world.workspace.id,
      capturedBy: world.alex.id,
      ownerId: world.alex.id,
      content: 'Book the venue',
      visibility: 'shared',
    });

    const task = expectOk(
      await InboxService.assignToProject(ctx.db, world.alex.id, {
        id: item.id,
        projectId: project.id,
      }),
    );
    expect(task.title).toBe('Book the venue');
    expect(task.projectId).toBe(project.id);

    const [refreshed] = await ctx.db.select().from(inboxItems).where(eq(inboxItems.id, item.id));
    expect(refreshed!.status).toBe('triaged');
    expect(refreshed!.triagedToProjectId).toBe(project.id);

    const projectTasks = await ctx.db.select().from(tasks).where(eq(tasks.projectId, project.id));
    expect(projectTasks).toHaveLength(1);
  });

  it('forbids the partner from triaging a private item (NOT_FOUND, no leak)', async () => {
    const project = await insertProject(ctx.db, {
      workspaceId: world.workspace.id,
      ownerId: world.jordan.id,
      visibility: 'shared',
    });
    const item = await insertInboxItem(ctx.db, {
      workspaceId: world.workspace.id,
      capturedBy: world.alex.id,
      ownerId: world.alex.id,
      visibility: 'private',
    });
    expectErr(
      await InboxService.assignToProject(ctx.db, world.jordan.id, {
        id: item.id,
        projectId: project.id,
      }),
      'NOT_FOUND',
    );
  });
});

describe('InboxService.dismiss', () => {
  it('marks an item dismissed', async () => {
    const item = await insertInboxItem(ctx.db, {
      workspaceId: world.workspace.id,
      capturedBy: world.alex.id,
      ownerId: world.alex.id,
      visibility: 'shared',
    });
    expectOk(await InboxService.dismiss(ctx.db, world.jordan.id, item.id));

    const [refreshed] = await ctx.db.select().from(inboxItems).where(eq(inboxItems.id, item.id));
    expect(refreshed!.status).toBe('dismissed');
  });
});
