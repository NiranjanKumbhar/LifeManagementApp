import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@clerk/backend', () => ({
  verifyToken: vi.fn(async (token: string) => ({ sub: token })),
  createClerkClient: () => ({ users: { getUser: vi.fn() } }),
}));

import { createTestDb, type TestDb } from '../__tests__/helpers/db.helper';
import { seedCouple, type SeededCouple } from '../__tests__/helpers/seed.helper';
import { callerFor } from '../__tests__/helpers/auth.helper';
import { insertNotification } from '../__tests__/factories/notification.factory';

let ctx: TestDb;
let world: SeededCouple;

beforeEach(async () => {
  ctx = await createTestDb();
  world = await seedCouple(ctx.db);
});
afterEach(async () => {
  await ctx.close();
});

describe('notificationRouter — list', () => {
  it('rejects unauthenticated callers', async () => {
    const caller = callerFor(ctx.db, null);
    await expect(caller.notification.list({})).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it("lists only the caller's own notifications, newest first", async () => {
    const older = await insertNotification(ctx.db, {
      userId: world.alex.id,
      workspaceId: world.workspace.id,
      title: 'Older',
      createdAt: new Date('2026-06-01T10:00:00.000Z'),
    });
    const newer = await insertNotification(ctx.db, {
      userId: world.alex.id,
      workspaceId: world.workspace.id,
      title: 'Newer',
      createdAt: new Date('2026-06-10T10:00:00.000Z'),
    });
    // Jordan's notification must not leak into Alex's list.
    await insertNotification(ctx.db, {
      userId: world.jordan.id,
      workspaceId: world.workspace.id,
      title: "Jordan's",
    });

    const alex = callerFor(ctx.db, world.alex.clerkId);
    const list = await alex.notification.list({});
    expect(list.map((n) => n.id)).toEqual([newer.id, older.id]);
  });

  it('filters to unread when unreadOnly is set', async () => {
    const unread = await insertNotification(ctx.db, {
      userId: world.alex.id,
      workspaceId: world.workspace.id,
      title: 'Unread',
    });
    await insertNotification(ctx.db, {
      userId: world.alex.id,
      workspaceId: world.workspace.id,
      title: 'Read',
      isRead: true,
    });

    const alex = callerFor(ctx.db, world.alex.clerkId);
    const list = await alex.notification.list({ unreadOnly: true });
    expect(list.map((n) => n.id)).toEqual([unread.id]);
  });
});

describe('notificationRouter — markRead', () => {
  it('marks a single notification read and stamps readAt', async () => {
    const notification = await insertNotification(ctx.db, {
      userId: world.alex.id,
      workspaceId: world.workspace.id,
    });
    const alex = callerFor(ctx.db, world.alex.clerkId);
    await alex.notification.markRead({ id: notification.id });

    const stillUnread = await alex.notification.list({ unreadOnly: true });
    expect(stillUnread.map((n) => n.id)).not.toContain(notification.id);
  });

  it('rejects marking a notification that is not yours', async () => {
    const notification = await insertNotification(ctx.db, {
      userId: world.jordan.id,
      workspaceId: world.workspace.id,
    });
    const alex = callerFor(ctx.db, world.alex.clerkId);
    await expect(alex.notification.markRead({ id: notification.id })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('returns NOT_FOUND for a missing notification', async () => {
    const alex = callerFor(ctx.db, world.alex.clerkId);
    await expect(alex.notification.markRead({ id: world.workspace.id })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});

describe('notificationRouter — markAllRead', () => {
  it("clears all of the caller's unread notifications but leaves the partner's", async () => {
    await insertNotification(ctx.db, { userId: world.alex.id, workspaceId: world.workspace.id });
    await insertNotification(ctx.db, { userId: world.alex.id, workspaceId: world.workspace.id });
    const jordansUnread = await insertNotification(ctx.db, {
      userId: world.jordan.id,
      workspaceId: world.workspace.id,
    });

    const alex = callerFor(ctx.db, world.alex.clerkId);
    await alex.notification.markAllRead();
    expect(await alex.notification.list({ unreadOnly: true })).toEqual([]);

    const jordan = callerFor(ctx.db, world.jordan.clerkId);
    const jordanUnread = await jordan.notification.list({ unreadOnly: true });
    expect(jordanUnread.map((n) => n.id)).toEqual([jordansUnread.id]);
  });
});
